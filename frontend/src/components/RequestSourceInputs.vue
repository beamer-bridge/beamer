<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3">
      <div class="flex flex-row justify-between">
        <span class="pl-2 text-xl">From</span>

        <Tooltip v-if="faucetEnabled" class="-mr-3 self-end">
          <SimpleTextButton :disabled="!faucetAvailable" @click="runFaucetRequest">
            <spinner v-if="faucetRequestActive" size-classes="w-3 h-3" border="2"></spinner>
            <template v-else>Get Test Tokens</template>
          </SimpleTextButton>
          <template #hint>
            This will provide you with a small amount of test tokens and test eth for the connected
            network. About 10 seconds after clicking the button you should see them in your
            connected wallet
          </template>
        </Tooltip>
      </div>
      <Selector
        v-model="selectedSourceChain"
        name="sourceChain"
        label="From"
        :options="chainOptions"
        :disabled="!sourceChainSelectionAvailable"
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
      <div class="flex h-20 flex-row gap-3">
        <div class="flex flex-[9_9_0%] flex-col items-start">
          <NumericInput
            v-model="selectedAmount"
            name="amount"
            required
            :valid="selectedAmount.length == 0 || isSelectedAmountValid"
          />
          <InputValidationMessage v-if="!isSelectedAmountValid && selectedAmount.length > 0">
            {{ v$.$validationGroups && v$.$validationGroups.amount.$errors[0].$message }}
          </InputValidationMessage>
          <div v-else class="self-end">
            <div v-if="balance">
              <spinner
                v-if="maxTransferableTokenBalanceLoading"
                size-classes="w-3 h-3"
                border="2"
                class="mr-5 mt-2"
              ></spinner>
              <template v-else>
                <Tooltip :disabled="balance.uint256.isZero()">
                  <div v-if="balance.uint256.isZero()" class="text-xs">
                    {{ formattedTokenBalance }} available
                  </div>
                  <SimpleTextButton
                    v-else
                    :disabled="maxTransferableTokenBalanceLoading"
                    @click="setMaxTokenAmount"
                  >
                    Balance:
                    <span :class="{ underline: formattedTokenBalance?.includes('<') }">
                      {{ formattedTokenBalance }}
                    </span>
                  </SimpleTextButton>
                  <template #hint>
                    You have {{ balance.formatFullValue() }} in your wallet.
                    <br />
                    Our current transfer limit is
                    {{ transferLimitTokenAmount?.formatFullValue() }}.
                  </template>
                </Tooltip>
              </template>
            </div>
          </div>
        </div>
        <div class="flex flex-[7_7_0%] flex-col">
          <Selector
            id="token"
            v-model="selectedToken"
            name="token"
            label="Token"
            :options="tokenOptions"
            placeholder="Token"
            required
            @opened="hideActionButton"
            @closed="showActionButton"
          />
          <Tooltip v-if="provider?.addToken" class="-mr-3 self-end">
            <SimpleTextButton :disabled="!addTokenAvailable" @click="handleAddTokenClick">
              Add to Wallet
            </SimpleTextButton>
            <template #hint> Adds current token to the connected wallet </template>
          </Tooltip>
        </div>
      </div>

      <div class="flex flex-col px-2 text-base">
        <div class="flex flex-row justify-between">
          <div class="flex flex-row gap-3">
            <span>Fees</span>
            <RequestFeeTooltip :formatted-min-fee="formattedMinFee"></RequestFeeTooltip>
          </div>
          <div class="text-sea-green">
            <spinner v-if="requestFeeLoading" border="2" size-classes="w-4 h-4"></spinner>
            <span v-else-if="requestFeeAmount">{{ requestFeeAmount.format() }}</span>
            <span v-else>- {{ selectedToken?.value.symbol ?? '' }}</span>
          </div>
        </div>
        <div class="flex flex-row justify-between font-semibold">
          <span>Total</span>
          <div class="text-sea-green">
            <spinner v-if="requestFeeLoading" size-classes="w-4 h-4" border="2"></spinner>
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

import NumericInput from '@/components/inputs/NumericInput.vue';
import Selector from '@/components/inputs/Selector.vue';
import InputValidationMessage from '@/components/layout/InputValidationMessage.vue';
import Tooltip from '@/components/layout/Tooltip.vue';
import RequestFeeTooltip from '@/components/RequestFeeTooltip.vue';
import Spinner from '@/components/Spinner.vue';
import { getChainSelectorOption, useChainSelection } from '@/composables/useChainSelection';
import { useFaucet } from '@/composables/useFaucet';
import { useMaxTransferableTokenAmount } from '@/composables/useMaxTransferableTokenAmount';
import { useRequestFee } from '@/composables/useRequestFee';
import { useRequestSourceInputValidations } from '@/composables/useRequestSourceInputValidations';
import { useTokenBalance } from '@/composables/useTokenBalance';
import { useTokenMinLpFee } from '@/composables/useTokenMinLpFee';
import { useTokenSelection } from '@/composables/useTokenSelection';
import { useTokenTransferLimit } from '@/composables/useTokenTransferLimit';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumWallet } from '@/stores/ethereum-wallet';
import { usePortals } from '@/stores/portals';
import type { Chain, Token } from '@/types/data';
import type { RequestSource, SelectorOption } from '@/types/form';
import { TokenAmount } from '@/types/token-amount';
import { isUnsignedNumeric, makeMatchingDecimalsValidator } from '@/validation/validators';

import SimpleTextButton from './layout/SimpleTextButton.vue';

interface Props {
  modelValue: RequestSource;
  targetChain: SelectorOption<Chain> | null;
}

interface Emits {
  (e: 'update:modelValue', value: RequestSource): void;
}

const props = defineProps<Props>();
const emits = defineEmits<Emits>();

const configuration = useConfiguration();
const { getTokensForChain } = useConfiguration();
const { hideActionButton, showActionButton } = usePortals();

const { provider, signerAddress } = storeToRefs(useEthereumWallet());
const { chains } = storeToRefs(configuration);

const selectedAmount = ref('');

const providerChainOption = computed(() => {
  const option = getChainSelectorOption(provider.value?.chainId.value, chains.value);
  return option?.disabled || option?.hidden ? undefined : option;
});

const _selectedSourceChain = ref<SelectorOption<Chain> | null>(null);
const selectedSourceChain = computed({
  get() {
    return providerChainOption.value ?? _selectedSourceChain.value;
  },
  async set(chain: SelectorOption<Chain> | null) {
    _selectedSourceChain.value = chain;
    if (chain && provider.value?.switchChainSafely) {
      await provider.value.switchChainSafely(chain.value);
    }
  },
});

const sourceChainSelectionAvailable = computed(
  () => !provider.value || !!provider.value.switchChainSafely,
);

// Need to switch chain in case the user selected one before connecting a wallet
watch(providerChainOption, async (_newProviderChainOption, previousProviderChainOption) => {
  if (provider.value && !previousProviderChainOption && _selectedSourceChain.value) {
    let switchSuccessful = false;
    if (provider.value.switchChainSafely) {
      switchSuccessful = await provider.value.switchChainSafely(_selectedSourceChain.value.value);
    }
    if (!switchSuccessful) {
      _selectedSourceChain.value = null;
    }
  }
});

const { chainOptions } = useChainSelection(chains, ref([]));

const selectedSourceChainTokens = computed(() =>
  getTokensForChain(selectedSourceChain.value?.value.identifier ?? -1),
);

const selectedToken = ref<SelectorOption<Token> | null>(null);
const addTokenAvailable = computed(() => !!provider.value && !!selectedToken.value);
const { tokenOptions } = useTokenSelection(selectedSourceChainTokens);

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
  computed(() => selectedSourceChain.value?.value.internalRpcUrl),
  computed(() => selectedSourceChain.value?.value.requestManagerAddress),
  selectedTokenAmount,
  computed(() => selectedSourceChain.value?.value),
  computed(() => props.targetChain?.value),
  true,
);

const { formattedBalance: formattedTokenBalance, balance } = useTokenBalance(
  provider,
  signerAddress,
  computed(() => selectedToken.value?.value ?? undefined),
);

const {
  maxTransferableTokenAmount: maxTransferableTokenBalance,
  loading: maxTransferableTokenBalanceLoading,
} = useMaxTransferableTokenAmount(
  balance,
  computed(() => selectedSourceChain.value?.value),
  computed(() => props.targetChain?.value),
);

const { formattedMinFee } = useTokenMinLpFee(
  computed(() => selectedSourceChain.value?.value),
  computed(() => props.targetChain?.value),
  computed(() => selectedToken.value?.value),
);
const { transferLimitTokenAmount } = useTokenTransferLimit(
  computed(() => selectedSourceChain.value?.value),
  computed(() => selectedToken.value?.value),
);

const {
  enabled: faucetEnabled,
  available: faucetAvailable,
  active: faucetRequestActive,
  run: runFaucetRequest,
} = useFaucet(
  signerAddress,
  computed(() => selectedSourceChain.value?.value.identifier),
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

watch(totalRequestTokenAmount, () => v$.value.selectedTokenAmount?.$touch());
watch(selectedSourceChain, () => {
  selectedToken.value =
    tokenOptions.value.find((token) => token.value.symbol === selectedToken.value?.value.symbol) ||
    null;
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
  transferLimitTokenAmount,
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
    if (
      transferLimitTokenAmount.value &&
      transferLimitTokenAmount.value.uint256.lt(maxTransferableTokenBalance.value.uint256)
    ) {
      selectedAmount.value = transferLimitTokenAmount.value.decimalAmount;
    } else {
      selectedAmount.value = maxTransferableTokenBalance.value.decimalAmount;
    }
  } else if (balance.value) {
    selectedAmount.value = balance.value.decimalAmount;
  }
};

const handleAddTokenClick = () => {
  if (provider.value && selectedToken.value && provider.value.addToken) {
    provider.value.addToken(selectedToken.value.value);
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
