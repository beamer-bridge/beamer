<template>
  <div class="request-form-inputs flex flex-col">
    <div class="mb-6">
      <div class="flex flex-row gap-5 items-center">
        <span class="text-3xl">Send</span>
        <FormKit
          type="text"
          outer-class="flex-1"
          name="amount"
          placeholder="0.00"
          validation="required"
          messages-class="hidden"
        />
        <FormKit
          id="tokenAddress"
          :value="selectedToken"
          type="selector"
          name="tokenAddress"
          outer-class="flex-1"
          :options="TOKENS"
          placeholder="Token"
          validation="required"
          messages-class="hidden"
          @input="switchToken"
        />
      </div>
      <div class="flex flex-col items-end">
        <div class="form-tooltip" data-theme="default" data-tip="Adds current token to Metamask">
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
        :options="CHAINS"
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
      v-if="fees"
      class="flex flex-row justify-end gap-3 items-center text-base text-light mt-4"
    >
      <span>fees</span>
      <span> {{ fees }} ETH</span>
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
import { computed, reactive, ref, watch } from 'vue';

import Spinner from '@/components/Spinner.vue';
import { requestFaucet } from '@/services/transactions/faucet';
import { getTokenDecimals } from '@/services/transactions/token';
import { BeamerConfigKey, EthereumProviderKey } from '@/symbols';
import { Token } from '@/types/config';
import type { SelectorOption } from '@/types/form';
import createAsyncProcess from '@/utils/create-async-process';
import { injectStrict } from '@/utils/vue-utils';

const ethereumProvider = injectStrict(EthereumProviderKey);
const beamerConfig = injectStrict(BeamerConfigKey);

interface Props {
  readonly fees: string;
}

defineProps<Props>();

const chainsConfiguration = beamerConfig.value.chains;

const getChainSelectorOption = (chainId: string) =>
  chainsConfiguration[chainId]
    ? {
        value: Number(chainId),
        label: chainsConfiguration[chainId]?.name,
      }
    : '';

const CHAINS: Array<SelectorOption | string> = Object.keys(chainsConfiguration).map((chainId) =>
  getChainSelectorOption(chainId),
);

const getTokenSelectorOption = (token: Token) => ({
  value: token.address,
  label: token.symbol,
});
const TOKENS: SelectorOption[] = chainsConfiguration[
  String(ethereumProvider.value.chainId.value)
]?.tokens.map((token) => getTokenSelectorOption(token));

const fromChainId = ref(getChainSelectorOption(String(ethereumProvider.value.chainId.value)));
const selectedToken = ref();

const switchChain = async (chainId: any) => {
  if (chainId !== ethereumProvider.value.chainId.value) {
    try {
      const isSuccessfulSwitch = await ethereumProvider.value.switchChain(chainId.value);
      if (isSuccessfulSwitch === null) {
        await ethereumProvider.value.addChain({
          chainId: chainId.value,
          name: chainsConfiguration[chainId.value].name,
          rpcUrl: chainsConfiguration[chainId.value].rpcUrl,
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
  try {
    if (ethereumProvider.value.signer.value) {
      const decimals = await getTokenDecimals(
        ethereumProvider.value.signer.value,
        selectedToken.value.value,
      );

      await ethereumProvider.value.addToken({
        address: selectedToken.value.value,
        symbol: selectedToken.value.label,
        decimals: Number(decimals),
      });
    }
  } catch (error) {
    console.error(error);
  }
};

watch(ethereumProvider.value.chainId, () => {
  location.reload();
});

const faucetUsedForChain: Record<string, boolean> = reactive({});
const faucetUsed = computed(() =>
  Boolean(faucetUsedForChain[(fromChainId.value as SelectorOption).value]),
);
const faucetButtonDisabled = computed(
  () => faucetUsed.value || !ethereumProvider.value.signer.value,
);

const addTokenButtonDisabled = computed(
  () => !ethereumProvider.value.signer.value || !selectedToken.value,
);

const executeFaucetRequest = async () => {
  if (!ethereumProvider.value.signerAddress.value) {
    throw new Error('Signer address missing!');
  }
  const chainId = (fromChainId.value as SelectorOption).value;
  const isSuccessfulFaucetRequest = await requestFaucet(
    chainId,
    ethereumProvider.value.signerAddress.value,
  );
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
</script>
<style lang="css">
.form-tooltip {
  @apply tooltip tooltip-left md:tooltip-right tooltip-primary bg-transparent text-justify z-50;
}
#tokenAddress.selector .vs__search::placeholder {
  @apply text-right;
}
.tooltip:before {
  @apply p-4;
}
.tooltip:before,
.tooltip:after {
  @apply md:ml-20;
}
</style>
