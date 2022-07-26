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
    </div>
    <div class="flex flex-col justify-between">
      <div class="flex flex-row gap-5">
        <div class="flex-[9_9_0%] flex flex-col items-end">
          <Input
            v-model="selectedAmount"
            name="amount"
            type="number"
            placeholder="0.00"
            required
          />
          <div>
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
            <span v-else-if="totalRequestAmount">{{ totalRequestAmount }}</span>
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

const selectedSourceChain = computed({
  get() {
    return getChainSelectorOption(String(provider.value?.chainId.value), chains.value);
  },
  async set(chain: SelectorOption<Chain> | null) {
    if (chain) {
      await provider.value?.switchChainSafely(chain.value);
    }
  },
});

const { chainOptions } = useChainSelection(chains, ref([]));

const selectedSourceChainIdentifier = computed(
  () => selectedSourceChain.value?.value.identifier ?? -1,
);

const { selectedToken, selectedTokenAddress, tokens, addTokenToProvider, addTokenAvailable } =
  useTokenSelection(chains, selectedSourceChainIdentifier, provider);

const { amount: requestFeeAmount, loading: requestFeeLoading } = useRequestFee(
  computed(() => selectedSourceChain.value?.value.rpcUrl),
  computed(() => selectedSourceChain.value?.value.requestManagerAddress),
  computed(() =>
    selectedAmount.value && selectedToken.value
      ? TokenAmount.parse(selectedAmount.value, selectedToken.value.value)
      : undefined,
  ),
  true,
);

const { available: showTokenBalance, formattedBalance: formattedTokenBalance } = useTokenBalance(
  provider,
  signer,
  selectedTokenAddress,
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

const totalRequestAmount = computed(() => {
  if (!props.modelValue.token || !requestFeeAmount.value) {
    return '';
  }
  const sourceAmount = TokenAmount.parse(props.modelValue.amount, props.modelValue.token.value);
  const total = requestFeeAmount.value?.uint256.add(sourceAmount.uint256);
  const totalAmount = new TokenAmount({
    amount: total.asString,
    token: props.modelValue.token.value,
  });
  return totalAmount.format();
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

watch(inputValues, (value) => emits('update:modelValue', value));
watch(
  () => props.modelValue,
  (value) => {
    inputValues.value = value;
  },
);
</script>
