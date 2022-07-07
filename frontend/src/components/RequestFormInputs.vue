<template>
  <div ref="formElement" class="request-form-inputs flex flex-col">
    <div class="mb-6">
      <div class="flex flex-row gap-5 items-stretch">
        <div class="h-18 flex flex-col justify-center">
          <span class="text-3xl">Send</span>
        </div>
        <div class="flex-1 flex flex-col items-end">
          <FormKit
            v-model="selectedAmount"
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
            id="token"
            v-model="selectedToken"
            type="selector"
            name="token"
            :options="tokens"
            placeholder="Token"
            validation="required"
            messages-class="hidden"
          />
          <Tooltip
            class="self-end -mr-3"
            hint="Adds current token to the connected wallet"
            show-outside-of-closest-reference-element
          >
            <button
              class="text-orange font-semibold m-2 rounded-md hover:bg-teal-light/30 px-5 py-2"
              :disabled="!addTokenAvailable"
              @click="addTokenToProvider"
            >
              Add to Wallet
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
    <div class="mb-6 flex flex-col">
      <FormKit
        v-model="selectedSourceChain"
        type="selector"
        name="sourceChain"
        label="From"
        :options="sourceChains"
        placeholder="Source Rollup"
        validation="required"
        messages-class="hidden"
        @input="switchChain"
      />
      <Tooltip
        class="self-end -mr-3"
        hint="This will provide you with a small amount of test tokens and test eth for the connected network. About 10 seconds after clicking the button you should see them in your connected wallet"
        show-outside-of-closest-reference-element
      >
        <button
          class="text-orange font-semibold m-2 rounded-md hover:bg-teal-light/30 px-5 py-2"
          :disabled="!faucetAvailable"
          @click="runFaucetRequest"
        >
          <div v-if="faucetRequestActive" class="h-5 w-5">
            <spinner></spinner>
          </div>
          <template v-else>Get Test Tokens</template>
        </button>
      </Tooltip>
    </div>
    <div>
      <FormKit
        outer-class="mb-4"
        type="selector"
        name="targetChain"
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
      <span>{{ formattedRequestFeeAmount }}</span>
      <Tooltip class="-mr-3" show-outside-of-closest-reference-element>
        <img class="h-6 w-6 mr-5 cursor-help" src="@/assets/images/help.svg" />
        <template #hint>
          The fee amount is composed of two parts:<br />
          <ul class="pl-5">
            <li>• the liquidity provider fee</li>
            <li>• the protocol fee</li>
          </ul>
          <br />
          The liquidity provider fee is paid out to the liquidity provider servicing the request,
          while the protocol fee stays with the contract and supports the Beamer platform
          development.<br />
          Note that the fee is paid on top of the token amount being transferred,so that the token
          amount received on the target rollup is exactly the same as the token amount sent from
          the source rollup.
        </template>
      </Tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FormKit } from '@formkit/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';

import Tooltip from '@/components/layout/Tooltip.vue';
import Spinner from '@/components/Spinner.vue';
import { useChainSelection } from '@/composables/useChainSelection';
import { useFaucet } from '@/composables/useFaucet';
import { useRequestFee } from '@/composables/useRequestFee';
import { useTokenBalance } from '@/composables/useTokenBalance';
import { useTokenSelection } from '@/composables/useTokenSelection';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { TokenAmount } from '@/types/token-amount';

const formElement = ref<HTMLElement>();
const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();

const { provider, signer } = storeToRefs(ethereumProvider);
const { chains } = storeToRefs(configuration);

const selectedAmount = ref('');

const { selectedSourceChain, sourceChains, targetChains, switchChain } = useChainSelection(
  provider,
  chains,
);

const selectedSourceChainIdentifier = computed(
  () => selectedSourceChain.value?.value.identifier ?? -1,
);

const { selectedToken, selectedTokenAddress, tokens, addTokenToProvider, addTokenAvailable } =
  useTokenSelection(chains, selectedSourceChainIdentifier, provider);

const { available: showRequestFee, formattedAmount: formattedRequestFeeAmount } = useRequestFee(
  computed(() => selectedSourceChain.value?.value.rpcUrl),
  computed(() => selectedSourceChain.value?.value.requestManagerAddress),
  computed(() =>
    selectedAmount.value && selectedToken.value
      ? TokenAmount.parse(selectedAmount.value, selectedToken.value.value)
      : undefined,
  ),
);

const { available: showTokenBalance, formattedBalance: formattedTokenBalance } = useTokenBalance(
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
  computed(() => selectedSourceChain.value?.value.identifier),
);
</script>
