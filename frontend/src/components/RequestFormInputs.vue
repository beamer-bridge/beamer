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
            v-model="selectedToken"
            type="selector"
            name="tokenAddress"
            :options="tokens"
            placeholder="Token"
            validation="required"
            messages-class="hidden"
          />
          <div
            class="form-tooltip self-end"
            data-theme="default"
            data-tip="Adds current token to Metamask"
          >
            <button
              class="btn btn-ghost btn-sm text-orange m-2"
              type="button"
              :disabled="!addTokenAvailable"
              @click="addTokenToProvider"
            >
              Add to Metamask
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="mb-6">
      <FormKit
        v-model="selectedSourceChain"
        type="selector"
        name="sourceChainId"
        label="From"
        :options="sourceChains"
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
            :disabled="!faucetAvailable"
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
        name="targetChainId"
        label="To"
        :options="targetChains"
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
import { computed } from 'vue';

import Spinner from '@/components/Spinner.vue';
import { useChainSelection } from '@/composables/useChainSelection';
import { useFaucet } from '@/composables/useFaucet';
import { useRequestFee } from '@/composables/useRequestFee';
import { useTokenBalance } from '@/composables/useTokenBalance';
import { useTokenSelection } from '@/composables/useTokenSelection';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();

const { provider, signer, chainId } = storeToRefs(ethereumProvider);
const { chains } = storeToRefs(configuration);

const requestManagerAddress = computed(() => chains.value[chainId.value]?.requestManagerAddress);

const { selectedSourceChain, sourceChains, targetChains, switchChain } = useChainSelection(
  provider,
  chains,
);

const { selectedToken, selectedTokenAddress, tokens, addTokenToProvider, addTokenAvailable } =
  useTokenSelection(provider, chains);

const { show: showRequestFee, formattedAmount: formattedRequestFeeAmount } = useRequestFee(
  provider,
  requestManagerAddress,
);

const { show: showTokenBalance, formattedBalance: formattedTokenBalance } = useTokenBalance(
  provider,
  signer,
  selectedTokenAddress,
);

const {
  available: faucetAvailable,
  active: faucetRequestActive,
  run: runFaucetRequest,
} = useFaucet(
  signer,
  computed(() => selectedSourceChain.value?.value),
);

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

.tooltip:before {
  @apply p-4;
}

.tooltip:before,
.tooltip:after {
  @apply md:ml-20;
}
</style>
