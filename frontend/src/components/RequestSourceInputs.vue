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
        @opened="hideActionButton"
        @closed="showActionButton"
      />
      <InputValidationMessage v-if="v$.selectedSourceChain.$error">
        {{ v$.selectedSourceChain.$errors[0].$message }}
      </InputValidationMessage>
    </div>
    <div class="flex flex-col justify-between">
      <div class="flex flex-row gap-5">
        <div class="flex-[9_9_0%] flex flex-col items-start">
          <Input
            v-model="selectedAmount"
            name="amount"
            type="text"
            pattern="^[0-9]*[.,]?[0-9]*$"
            inputmode="decimal"
            autocomplete="off"
            autocorrect="off"
            placeholder="0.00"
            required
            :valid="isSelectedAmountValid"
          />
          <InputValidationMessage v-if="!isSelectedAmountValid">
            {{ v$.$validationGroups && v$.$validationGroups.amount.$errors[0].$message }}
          </InputValidationMessage>
          <div v-else class="self-end">
            <div v-if="showTokenBalance && balance" class="text-base">
              <spinner
                v-if="maxTransferableTokenBalanceLoading"
                size="6"
                border="2"
                class="mr-5 mt-1"
              ></spinner>
              <template v-else>
                <div v-if="balance.uint256.isZero()">{{ formattedTokenBalance }} available</div>
                <Tooltip
                  v-else
                  :hint="`You have ${balance.formatFullValue()} in your wallet. Click to use all.`"
                  show-outside-of-closest-reference-element
                >
                  <button
                    class="text-orange text-base font-semibold my-1 rounded-md hover:bg-sea-green/30 px-5 disabled:hover:bg-transparent disabled:opacity-25 disabled:text-grey"
                    :disabled="maxTransferableTokenBalanceLoading"
                    @click="setMaxTokenAmount"
                  >
                    <span :class="{ underline: formattedTokenBalance?.includes('<') }">
                      {{ formattedTokenBalance }}
                    </span>
                    available
                  </button>
                </Tooltip>
              </template>
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
            @opened="hideActionButton"
            @closed="showActionButton"
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
            <RequestFeeTooltip :formatted-min-fee="formattedMinFee"></RequestFeeTooltip>
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
import { storeToRefs } from 'pinia';
import type { WritableComputedRef } from 'vue';
import { computed, ref, watch } from 'vue';

import Input from '@/components/inputs/Input.vue';
import Selector from '@/components/inputs/Selector.vue';
import InputValidationMessage from '@/components/layout/InputValidationMessage.vue';
import Tooltip from '@/components/layout/Tooltip.vue';
import RequestFeeTooltip from '@/components/RequestFeeTooltip.vue';
import Spinner from '@/components/Spinner.vue';
import { getChainSelectorOption, useChainSelection } from '@/composables/useChainSelection';
import { useFaucet } from '@/composables/useFaucet';
import { useMaxTransferableTokenAmount } from '@/composables/useMaxTransferableTokenAmount';
import { useMinRequestFee } from '@/composables/useMinRequestFee';
import { useRequestFee } from '@/composables/useRequestFee';
import { useRequestSourceInputValidations } from '@/composables/useRequestSourceInputValidations';
import { useTokenBalance } from '@/composables/useTokenBalance';
import { useTokenSelection } from '@/composables/useTokenSelection';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { usePortals } from '@/stores/portals';
import type { Chain } from '@/types/data';
import type { RequestSource, SelectorOption } from '@/types/form';
import { TokenAmount } from '@/types/token-amount';
import { isUnsignedNumeric, makeMatchingDecimalsValidator } from '@/validation/validators';

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
const { hideActionButton, showActionButton } = usePortals();

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

const { selectedToken, tokens, addTokenToProvider, addTokenAvailable } = useTokenSelection(
  chains,
  selectedSourceChainIdentifier,
  provider,
);

const selectedTokenAmount = computed(() => {
  if (
    selectedToken.value &&
    selectedAmount.value &&
    isUnsignedNumeric(selectedAmount.value) &&
    makeMatchingDecimalsValidator(selectedToken.value.value.decimals)(selectedAmount.value)
  ) {
    return TokenAmount.parse(selectedAmount.value, selectedToken.value.value);
  } else {
    return undefined;
  }
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
} = useTokenBalance(
  provider,
  signer,
  computed(() => selectedToken?.value?.value ?? undefined),
);

const {
  maxTransferableTokenAmount: maxTransferableTokenBalance,
  loading: maxTransferableTokenBalanceLoading,
} = useMaxTransferableTokenAmount(
  balance,
  computed(() => selectedSourceChain.value?.value),
);

const {
  enabled: faucetEnabled,
  available: faucetAvailable,
  active: faucetRequestActive,
  run: runFaucetRequest,
} = useFaucet(
  signer,
  computed(() => selectedSourceChain.value?.value.identifier),
);
const { formattedMinFee } = useMinRequestFee(
  computed(() => selectedSourceChain?.value?.value),
  computed(() => selectedToken.value?.value),
);

const totalRequestTokenAmount = computed(() => {
  if (
    !selectedToken.value ||
    !selectedTokenAmount.value ||
    !requestFeeAmount.value ||
    requestFeeLoading.value
  ) {
    return undefined;
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

const v$ = useRequestSourceInputValidations({
  selectedSourceChain,
  selectedToken,
  selectedAmount,
  selectedTokenAmount,
  totalRequestTokenAmount,
  requestFeeLoading,
  balance,
});
defineExpose({ v$ });

const isSelectedAmountValid = computed(() => {
  return !v$.value.$validationGroups?.amount || !v$.value.$validationGroups.amount.$error;
});

const setMaxTokenAmount = async () => {
  if (maxTransferableTokenBalance.value) {
    selectedAmount.value = maxTransferableTokenBalance.value.decimalAmount;
  } else if (balance.value) {
    selectedAmount.value = balance.value.decimalAmount;
  }
};

watch(selectedToken, () => {
  if (selectedAmount.value) {
    v$.value.$touch();
  }
});
watch(inputValues, (value) => emits('update:modelValue', value));
watch(
  () => props.modelValue,
  (value) => {
    inputValues.value = value;
  },
);
</script>
