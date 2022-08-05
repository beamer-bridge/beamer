<template>
  <div class="flex flex-col gap-7">
    <div class="flex flex-col gap-5">
      <div class="flex flex-row justify-between">
        <span class="text-3xl">From</span>

        <Tooltip
          v-if="faucetEnabled"
          class="self-end -mr-3"
          hint="This will provide you with a small amount of test tokens and test eth for the connected network. About 10 seconds after clicking the button you should see them in your connected wallet"
          show-outside-of-closest-reference-element
        >
          <button
            class="text-orange text-base font-semibold mr-3 rounded-md hover:bg-sea-green/30 px-5 disabled:hover:bg-transparent disabled:opacity-25 disabled:text-grey"
            :disabled="!faucetAvailable"
            @click="runFaucetRequest"
          >
            <spinner v-if="faucetRequestActive" size="6" border="2"></spinner>
            <template v-else>Get Test Tokens</template>
          </button>
        </Tooltip>
      </div>
      <Selector
        v-model="selectedSourceChain"
        name="sourceChain"
        label="From"
        :options="chainOptions"
        placeholder="Source Rollup"
        required
      />
      <InputValidationMessage
        v-if="v$.sourceChain.$error"
        :message="v$.sourceChain.$errors[0].$message"
      />
    </div>
    <div class="flex flex-col justify-between">
      <div class="flex flex-row gap-5">
        <div class="flex-[9_9_0%] flex flex-col items-start">
          <!-- Todo: refactor keydown event to a reusable directive -->
          <Input
            v-model="selectedAmount"
            name="amount"
            type="number"
            placeholder="0.00"
            required
            :valid="isSelectedAmountValid"
            @keydown="(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()"
          />
          <InputValidationMessage v-if="!isSelectedAmountValid">
            {{ v$.$validationGroups && v$.$validationGroups.amount.$errors[0].$message }}
          </InputValidationMessage>
          <div v-else class="self-end">
            <div v-if="showTokenBalance" class="text-base mr-5 mt-1">
              {{ formattedTokenBalance }} {{ selectedToken?.label }} available
            </div>
          </div>
        </div>
        <div class="flex-[7_7_0%] flex flex-col">
          <Selector
            id="token"
            v-model="selectedToken"
            name="token"
            label="Token"
            :options="tokens"
            placeholder="Token"
            required
          />
          <Tooltip
            class="self-end -mr-3"
            hint="Adds current token to the connected wallet"
            show-outside-of-closest-reference-element
          >
            <button
              class="text-orange text-base font-semibold mr-3 my-1 rounded-md hover:bg-sea-green/30 px-5 disabled:hover:bg-transparent disabled:opacity-25 disabled:text-grey"
              :disabled="!addTokenAvailable"
              @click="addTokenToProvider"
            >
              Add to Wallet
            </button>
          </Tooltip>
        </div>
      </div>

      <div class="flex flex-col text-2xl px-5">
        <div class="flex flex-row justify-between">
          <div class="flex flex-row gap-3">
            <span>Fees</span>
            <Tooltip class="-mr-3" show-outside-of-closest-reference-element>
              <div class="h-full flex flex-col justify-center">
                <img class="h-6 w-6 cursor-help" src="@/assets/images/help.svg" />
              </div>
              <template #hint>
                The fee amount is composed of two parts:<br />
                <ul class="pl-5">
                  <li>• the liquidity provider fee</li>
                  <li>• the protocol fee</li>
                </ul>
                <br />
                The liquidity provider fee is paid out to the liquidity provider servicing the
                request, while the protocol fee stays with the contract and supports the Beamer
                platform development.<br />
                Note that the fee is paid on top of the token amount being transferred,so that the
                token amount received on the target rollup is exactly the same as the token amount
                sent from the source rollup.
              </template>
            </Tooltip>
          </div>
          <div class="text-sea-green">
            <spinner v-if="requestFeeLoading" size="6" border="2"></spinner>
            <span v-else-if="requestFeeAmount">{{ requestFeeAmount.format() }}</span>
            <span v-else>- {{ selectedToken?.value.symbol ?? '' }}</span>
          </div>
        </div>
        <div class="flex flex-row justify-between font-semibold">
          <span>Total</span>
          <div class="text-sea-green">
            <spinner v-if="requestFeeLoading" size="6" border="2"></spinner>
            <span v-else-if="totalRequestTokenAmount"
              >{{ totalRequestTokenAmount.format() }}
            </span>
            <span v-else>- {{ selectedToken?.value.symbol ?? '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVuelidate } from '@vuelidate/core';
import { helpers, required, sameAs } from '@vuelidate/validators';
import { storeToRefs } from 'pinia';
import type { WritableComputedRef } from 'vue';
import { computed, ref, watch } from 'vue';

import Input from '@/components/inputs/Input.vue';
import Selector from '@/components/inputs/Selector.vue';
import InputValidationMessage from '@/components/layout/InputValidationMessage.vue';
import Tooltip from '@/components/layout/Tooltip.vue';
import Spinner from '@/components/Spinner.vue';
import { getChainSelectorOption, useChainSelection } from '@/composables/useChainSelection';
import { useFaucet } from '@/composables/useFaucet';
import { useRequestFee } from '@/composables/useRequestFee';
import { useTokenBalance } from '@/composables/useTokenBalance';
import { useTokenSelection } from '@/composables/useTokenSelection';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import type { Chain } from '@/types/data';
import type { RequestSource, SelectorOption } from '@/types/form';
import { TokenAmount } from '@/types/token-amount';
import { isMatchingDecimals, maxTokenAmount, minTokenAmount } from '@/validation/validators';

interface Props {
  modelValue: RequestSource;
}

interface Emits {
  (e: 'update:modelValue', value: RequestSource): void;
}

const props = defineProps<Props>();
const emits = defineEmits<Emits>();

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();

const { provider, signer } = storeToRefs(ethereumProvider);
const { chains } = storeToRefs(configuration);

const selectedAmount = ref('');

const providerChainOption = computed(() =>
  getChainSelectorOption(String(provider.value?.chainId.value), chains.value),
);

const _selectedSourceChain = ref<SelectorOption<Chain> | null>(null);
const selectedSourceChain = computed({
  get() {
    return providerChainOption.value ?? _selectedSourceChain.value;
  },
  async set(chain: SelectorOption<Chain> | null) {
    _selectedSourceChain.value = chain;
    if (chain) {
      await provider.value?.switchChainSafely(chain.value);
    }
  },
});

// Need to switch chain in case the user selected one before connecting a wallet
watch(providerChainOption, (_newProviderChainOption, previousProviderChainOption) => {
  if (provider.value && !previousProviderChainOption && _selectedSourceChain.value) {
    const switchSuccessful = provider.value.switchChainSafely(_selectedSourceChain.value.value);
    if (!switchSuccessful) {
      _selectedSourceChain.value = null;
    }
  }
});

const { chainOptions } = useChainSelection(chains, ref([]));

const selectedSourceChainIdentifier = computed(
  () => selectedSourceChain.value?.value.identifier ?? -1,
);

const { selectedToken, selectedTokenAddress, tokens, addTokenToProvider, addTokenAvailable } =
  useTokenSelection(chains, selectedSourceChainIdentifier, provider);

const selectedTokenAmount = computed(() => {
  if (
    selectedToken.value &&
    selectedAmount.value &&
    isMatchingDecimals(selectedToken.value.value.decimals)(selectedAmount.value)
  ) {
    return TokenAmount.parse(selectedAmount.value, selectedToken.value.value);
  } else return undefined;
});
const { amount: requestFeeAmount, loading: requestFeeLoading } = useRequestFee(
  computed(() => selectedSourceChain.value?.value.rpcUrl),
  computed(() => selectedSourceChain.value?.value.requestManagerAddress),
  selectedTokenAmount,
  true,
);

const {
  available: showTokenBalance,
  formattedBalance: formattedTokenBalance,
  balance,
} = useTokenBalance(provider, signer, selectedTokenAddress);

const {
  enabled: faucetEnabled,
  available: faucetAvailable,
  active: faucetRequestActive,
  run: runFaucetRequest,
} = useFaucet(
  signer,
  computed(() => selectedSourceChain.value?.value.identifier),
);

const totalRequestTokenAmount = computed(() => {
  if (
    !selectedToken.value ||
    !selectedTokenAmount.value ||
    !requestFeeAmount.value ||
    requestFeeLoading.value
  ) {
    return null;
  }
  const total = requestFeeAmount.value.uint256.add(selectedTokenAmount.value.uint256);
  const totalAmount = new TokenAmount({
    amount: total.asString,
    token: selectedToken.value.value,
  });
  return totalAmount;
});

const inputValues: WritableComputedRef<RequestSource> = computed({
  get: () => ({
    amount: selectedAmount.value,
    sourceChain: selectedSourceChain.value,
    token: selectedToken.value,
  }),
  set: (formValues: RequestSource) => {
    selectedAmount.value = formValues.amount;
    selectedSourceChain.value = formValues.sourceChain;
    selectedToken.value = formValues.token;
  },
});

const computedRules = computed(() => {
  const sourceChainRules = {
    $autoDirty: true,
    required,
  };
  const tokenRules = {
    $autoDirty: true,
    required,
  };
  const requestFeeLoadingRules = {
    $autoDirty: true,
    sameAs: sameAs(false),
  };

  if (selectedToken.value) {
    const selectedTokenValue = selectedToken.value.value;
    const selectedTokenDecimals = selectedTokenValue.decimals;
    const selectedAmountRules = {
      $autoDirty: true,
      required: helpers.withMessage('Amount is required', required),
      isMatchingDecimals: helpers.withMessage(
        'Decimals out of boundary',
        isMatchingDecimals(selectedTokenDecimals),
      ),
    };
    if (selectedTokenAmount.value) {
      const min = TokenAmount.parse(
        ['0.', '0'.repeat(selectedTokenDecimals - 1), '1'].join(''),
        selectedTokenValue,
      );
      const selectedTokenAmountRules = {
        $autoDirty: true,
        minValue: helpers.withMessage(`Amount must be a positive number`, minTokenAmount(min)),
      };
      const totalRequestTokenAmountRules = {
        $autoDirty: true,
        maxValue: helpers.withMessage('Insufficient funds', (value: TokenAmount) => {
          if (!value || !selectedToken.value) return true;
          // Due to reactivity issues `max` has to be initialized here
          const max = new TokenAmount({
            amount: balance.value.toString(),
            token: selectedToken.value.value,
          });
          return maxTokenAmount(max)(value);
        }),
      };
      return {
        sourceChain: sourceChainRules,
        token: tokenRules,
        selectedAmount: selectedAmountRules,
        selectedTokenAmount: selectedTokenAmountRules,
        totalRequestTokenAmount: totalRequestTokenAmountRules,
        requestFeeLoading: requestFeeLoadingRules,
        $validationGroups: {
          amount: ['selectedTokenAmount', 'selectedAmount', 'totalRequestTokenAmount'],
        },
      };
    }

    return {
      sourceChain: sourceChainRules,
      token: tokenRules,
      selectedAmount: selectedAmountRules,
      requestFeeLoading: requestFeeLoadingRules,
      $validationGroups: {
        amount: ['selectedAmount'],
      },
    };
  }
  return {
    sourceChain: sourceChainRules,
    token: tokenRules,
  };
});

const state = {
  sourceChain: selectedSourceChain,
  token: selectedToken,
  selectedAmount,
  selectedTokenAmount,
  totalRequestTokenAmount,
  requestFeeLoading,
};

const v$ = useVuelidate(computedRules, state);

defineExpose({ v$ });

const isSelectedAmountValid = computed(() => {
  return !v$.value.$validationGroups?.amount || !v$.value.$validationGroups.amount.$error;
});

watch(selectedToken, () => {
  if (selectedAmount.value) v$.value.$touch();
});
watch(inputValues, (value) => emits('update:modelValue', value));
watch(
  () => props.modelValue,
  (value) => {
    inputValues.value = value;
  },
);
</script>
