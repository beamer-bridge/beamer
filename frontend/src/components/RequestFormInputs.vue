<template>
  <div class="request-form-inputs flex flex-col">
    <div class="mb-6">
      <div class="flex flex-row gap-5 items-stretch">
        <div class="h-18 flex flex-col justify-center">
          <span class="text-3xl">Send</span>
        </div>
        <div class="flex-1 flex flex-col items-end">
          <FormKit
            type="text"
            name="amount"
            placeholder="0.00"
            validation="required"
            messages-class="hidden"
          />
          <div>
            <div v-if="showTokenBalance" class="text-sm m-3 mr-5">
              {{ formattedTokenBalance }} {{ selectedToken?.label }} available
            </div>
          </div>
        </div>
        <div class="flex-1 flex flex-col">
          <FormKit
            id="tokenAddress"
            :value="selectedToken"
            type="selector"
            name="tokenAddress"
            :options="TOKENS"
            placeholder="Token"
            validation="required"
            messages-class="hidden"
            @input="switchToken"
          />
          <div
            class="form-tooltip self-end"
            data-theme="default"
            data-tip="Adds current token to Metamask"
          >
            <button
              class="btn btn-ghost btn-sm text-orange m-2"
              type="button"
              :disabled="addTokenButtonDisabled"
              @click="addToken"
            >
              Add to Metamask
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="mb-6">
      <FormKit
        :value="fromChainId"
        type="selector"
        name="fromChainId"
        label="From"
        :options="CHAINS"
        placeholder="Source Rollup"
        validation="required"
        messages-class="hidden"
        @input="switchChain"
      />
      <div class="flex flex-col items-end">
        <div
          class="form-tooltip"
          data-theme="default"
          data-tip="This will provide you with a small amount of test tokens and test eth for the connected network. About 10 seconds after clicking the button you should see them in your Metamask account"
        >
          <button
            class="btn btn-ghost btn-sm text-orange m-2"
            type="button"
            :disabled="faucetButtonDisabled"
            @click="runFaucetRequest"
          >
            <div v-if="faucetRequestActive" class="h-5 w-5">
              <spinner></spinner>
            </div>
            <template v-else>Get Test Tokens</template>
          </button>
        </div>
      </div>
    </div>
    <div>
      <FormKit
        outer-class="mb-4"
        type="selector"
        name="toChainId"
        label="To"
        :options="TARGET_CHAINS"
        placeholder="Target Rollup"
        validation="required"
        messages-class="hidden"
      />
      <FormKit
        type="text"
        outer-class="flex-1"
        name="toAddress"
        placeholder="Address"
        validation="required"
        messages-class="hidden"
      />
    </div>
    <div
      v-if="showRequestFee"
      class="flex flex-row justify-end gap-3 items-center text-base text-light mt-4"
    >
      <span>fees</span>
      <span>{{ formattedRequestFeeAmount }} ETH</span>
      <div
        class="form-tooltip whitespace-pre-wrap"
        data-theme="default"
        :data-tip="gasFeesTooltipText"
      >
        <img class="h-6 w-6 mr-5 cursor-help" src="@/assets/images/help.svg" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FormKit } from '@formkit/vue';
import { storeToRefs } from 'pinia';
import { computed, reactive, Ref, ref } from 'vue';

import Spinner from '@/components/Spinner.vue';
import { useRequestFee } from '@/composables/useRequestFee';
import { useTokenBalance } from '@/composables/useTokenBalance';
import { requestFaucet } from '@/services/transactions/faucet';
import { getTokenDecimals } from '@/services/transactions/token';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import type { Token } from '@/types/config';
import type { SelectorOption } from '@/types/form';
import createAsyncProcess from '@/utils/create-async-process';

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();

const getChainSelectorOption: (chainId: string) => SelectorOption | string = (chainId: string) =>
  configuration.chains[chainId]
    ? {
        value: Number(chainId),
        label: configuration.chains[chainId]?.name,
      }
    : '';

const CHAINS: Array<SelectorOption | string> = Object.keys(configuration.chains).map((chainId) =>
  getChainSelectorOption(chainId),
);

const getTokenSelectorOption = (token: Token) => ({
  value: token.address,
  label: token.symbol,
});

const TOKENS: SelectorOption[] = configuration.chains[
  String(ethereumProvider.chainId)
]?.tokens.map((token) => getTokenSelectorOption(token));

const fromChainId = ref(getChainSelectorOption(String(ethereumProvider.chainId)));
const selectedToken = ref();
const selectedTokenAddress = computed(() => selectedToken.value?.value);

const TARGET_CHAINS: Array<SelectorOption | string> = CHAINS.filter(
  (chain: SelectorOption | string) =>
    (chain as SelectorOption).value !== (fromChainId.value as SelectorOption).value,
);

const switchChain = async (chainId: Ref<number>) => {
  if (ethereumProvider.provider && chainId.value !== ethereumProvider.chainId) {
    try {
      const isSuccessfulSwitch = await ethereumProvider.provider.switchChain(chainId.value);
      if (isSuccessfulSwitch === null) {
        await ethereumProvider.provider.addChain({
          chainId: chainId.value,
          name: configuration.chains[chainId.value].name,
          rpcUrl: configuration.chains[chainId.value].rpcUrl,
        });
      }
    } catch (error) {
      location.reload();
    }
  }
};

const switchToken = (token: SelectorOption) => {
  selectedToken.value = token;
};

const addToken = async () => {
  if (!selectedToken.value) {
    return;
  }
  try {
    if (ethereumProvider.provider && ethereumProvider.signer) {
      const decimals = await getTokenDecimals(
        ethereumProvider.provider,
        selectedToken.value.value,
      );

      await ethereumProvider.provider.addToken({
        address: selectedToken.value.value,
        symbol: selectedToken.value.label,
        decimals: Number(decimals),
      });
    }
  } catch (error) {
    console.error(error);
  }
};

const faucetUsedForChain: Record<string, boolean> = reactive({});
const faucetUsed = computed(() =>
  Boolean(faucetUsedForChain[(fromChainId.value as SelectorOption).value]),
);
const faucetButtonDisabled = computed(() => faucetUsed.value || !ethereumProvider.signer);

const addTokenButtonDisabled = computed(() => !ethereumProvider.signer || !selectedToken.value);

const executeFaucetRequest = async () => {
  if (!ethereumProvider.signerAddress) {
    throw new Error('Signer address missing!');
  }
  const chainId = (fromChainId.value as SelectorOption).value;
  const isSuccessfulFaucetRequest = await requestFaucet(chainId, ethereumProvider.signerAddress);
  if (isSuccessfulFaucetRequest) {
    faucetUsedForChain[chainId] = true;
  }
};
const { active: faucetRequestActive, run: runFaucetRequest } =
  createAsyncProcess(executeFaucetRequest);

const gasFeesTooltipText = `The fee amount is composed of three parts:
  • the gas reimbursement fee
  • the liquidity provider fee
  • the Beamer service fee

The gas reimbursement fee and the liquidity provider fee are paid out to the liquidity provider servicing the request, while the Beamer service fee stays with the contract and supports the Beamer platform development.

Note that the fee is paid on top of the token amount being transferred,so that the token amount received on the target rollup is exactly the same as the token amount sent from the source rollup.`;

const { provider, signer, chainId } = storeToRefs(ethereumProvider);

const requestManagerAddress = computed(
  () => configuration.chains[chainId.value]?.requestManagerAddress,
);

const { show: showRequestFee, formattedAmount: formattedRequestFeeAmount } = useRequestFee(
  provider,
  requestManagerAddress,
);

const { show: showTokenBalance, formattedBalance: formattedTokenBalance } = useTokenBalance(
  provider,
  signer,
  selectedTokenAddress,
);
</script>

<style lang="css">
.form-tooltip {
  @apply tooltip tooltip-left md:tooltip-right tooltip-primary bg-transparent text-justify z-50;
}

.tooltip:before {
  @apply p-4;
}

.tooltip:before,
.tooltip:after {
  @apply md:ml-20;
}
</style>
