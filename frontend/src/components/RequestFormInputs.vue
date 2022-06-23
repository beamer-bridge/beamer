<template>
  <div class="request-form-inputs flex flex-col">
    <div class="mb-6">
      <div class="flex flex-row gap-5 items-stretch">
        <div class="h-18 flex flex-col justify-center">
          <span class="text-3xl">Send</span>
        </div>
        <div class="flex-1 flex flex-col items-end">
          <TextInput
            v-model="selectedAmount"
            name="amount"
            placeholder="0.00"
            required
            @input="updateValues"
          />
          <div>
            <div v-if="showTokenBalance" class="text-sm m-3 mr-5">
              {{ formattedTokenBalance }} {{ selectedToken?.label }} available
            </div>
          </div>
        </div>
        <div class="flex-1 flex flex-col">
          <Selector
            id="token"
            v-model="selectedToken"
            name="token"
            :options="tokens"
            placeholder="Token"
            required
            @input="updateValues"
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
      <Selector
        v-model="selectedSourceChain"
        name="sourceChain"
        label="From"
        :options="sourceChains"
        placeholder="Source Rollup"
        required
        @input="
          updateValues();
          switchChain($event);
        "
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
    <Selector
      v-model="selectedTargetChain"
      class="mb-4"
      label="To"
      name="targetChain"
      :options="targetChains"
      placeholder="Target Rollup"
      required
      @input="updateValues"
    />
    <TextInput
      v-model="selectedTargetAddress"
      name="toAddress"
      placeholder="Address"
      required
      @input="updateValues"
    />
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
import { storeToRefs } from 'pinia';
import type { WritableComputedRef } from 'vue';
import { computed, ref, watch } from 'vue';

import Selector from '@/components/inputs/Selector.vue';
import TextInput from '@/components/inputs/TextInput.vue';
import Tooltip from '@/components/layout/Tooltip.vue';
import Spinner from '@/components/Spinner.vue';
import { useChainSelection } from '@/composables/useChainSelection';
import { useFaucet } from '@/composables/useFaucet';
import { useRequestFee } from '@/composables/useRequestFee';
import { useTokenBalance } from '@/composables/useTokenBalance';
import { useTokenSelection } from '@/composables/useTokenSelection';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import type { Chain } from '@/types/data';
import type { RequestFormResult, SelectorOption } from '@/types/form';
import { TokenAmount } from '@/types/token-amount';

interface Props {
  modelValue: RequestFormResult;
}

interface Emits {
  (e: 'update:modelValue', value: RequestFormResult): void;
}

const props = defineProps<Props>();
const emits = defineEmits<Emits>();

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();

const { provider, signer } = storeToRefs(ethereumProvider);
const { chains } = storeToRefs(configuration);

const selectedAmount = ref('');
const selectedTargetChain = ref<SelectorOption<Chain> | null>(null);
const selectedTargetAddress = ref('');

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

const inputValues: WritableComputedRef<RequestFormResult> = computed({
  get: () => ({
    amount: selectedAmount.value,
    sourceChain: selectedSourceChain.value,
    targetChain: selectedTargetChain.value,
    toAddress: selectedTargetAddress.value,
    token: selectedToken.value,
  }),
  set: (formValues: RequestFormResult) => {
    selectedAmount.value = formValues.amount;
    selectedSourceChain.value = formValues.sourceChain;
    selectedTargetChain.value = formValues.targetChain;
    selectedTargetAddress.value = formValues.toAddress;
    selectedToken.value = formValues.token;
  },
});

const updateValues = () => emits('update:modelValue', inputValues.value);
watch(
  () => props.modelValue,
  (value) => {
    inputValues.value = value;
  },
);
</script>
