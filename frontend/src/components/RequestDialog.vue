<template>
  <div class="relative bg-transparent flex flex-col justify-between h-full">
    <RequestSourceInputs v-model="requestSource" class="rounded-br-lg bg-teal px-16 py-10" />
    <div class="relative">
      <div class="absolute -top-18 flex flex-row w-full justify-center">
        <img class="h-36 w-36" src="@/assets/images/Signet.svg" />
      </div>
    </div>
    <RequestTargetInputs
      v-model="requestTarget"
      :amount="requestSource.amount"
      :source-chain="requestSource.sourceChain"
      :token="requestSource.token"
      class="rounded-tl-lg rounded-b-lg bg-teal px-16 py-10"
    />
  </div>

  <Teleport v-if="signer" to="#action-button-portal">
    <div v-if="transferFundsButtonVisible" class="flex flex-col items-center">
      <div v-if="DISCLAIMER_REQUIRED" class="relative">
        <div class="absolute -top-11 -left-44 w-96 m-auto flex flex-row gap-5">
          <!--  
            There seems to be a problem with tailwind and escaping the backslash in the TS variable. 
            For this reason the content rule is added separately here in the HTML.
          -->
          <input
            v-model="disclaimerChecked"
            type="checkbox"
            class="checked:after:content-['\2713']"
            :class="checkboxClasses"
          />
          <span class="text-lg"
            >I agree to the
            <a
              href="https://beamerbridge.com/terms.html"
              target="_blank"
              class="underline hover:opacity-90"
              >Terms & Conditions</a
            ></span
          >
        </div>
      </div>
      <ActionButton class="w-full" :disabled="creatingTransaction" @click="submitForm">
        <span v-if="!creatingTransaction"> Transfer Funds </span>
        <spinner v-else size="8" border="4"></spinner>
      </ActionButton>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import ActionButton from '@/components/layout/ActionButton.vue';
import RequestSourceInputs from '@/components/RequestSourceInputs.vue';
import RequestTargetInputs from '@/components/RequestTargetInputs.vue';
import Spinner from '@/components/Spinner.vue';
import { useToggleOnActivation } from '@/composables/useToggleOnActivation';
import { useTransferRequest } from '@/composables/useTransferRequest';
import { switchToActivities } from '@/router/navigation';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useSettings } from '@/stores/settings';
import { useTransferHistory } from '@/stores/transfer-history';
import type {
  RequestSource,
  RequestTarget,
  ValidRequestSource,
  ValidRequestTarget,
} from '@/types/form';

const EMPTY_SOURCE_DATA: RequestSource = {
  amount: '',
  sourceChain: null,
  token: null,
};
const EMPTY_TARGET_DATA: RequestTarget = {
  targetChain: null,
  toAddress: '',
};
const DISCLAIMER_REQUIRED = process.env.NODE_ENV === 'production';

const ethereumProvider = useEthereumProvider();
const { signer, signerAddress, chainId, provider } = storeToRefs(ethereumProvider);
const transferHistory = useTransferHistory();
const { activated: transferFundsButtonVisible } = useToggleOnActivation();
const {
  create: createTransfer,
  execute: executeTransfer,
  creating: creatingTransaction,
} = useTransferRequest();
const { getTokenForChain } = useConfiguration();
const { disclaimerChecked } = storeToRefs(useSettings());

const requestSource: Ref<RequestSource> = ref(EMPTY_SOURCE_DATA);
const requestTarget: Ref<RequestTarget> = ref(EMPTY_TARGET_DATA);

const disclaimerValid = computed(() => disclaimerChecked.value || !DISCLAIMER_REQUIRED);

const submitForm = async () => {
  if (!disclaimerValid.value) {
    throw new Error('Form not valid!');
  }
  const validRequestSource = requestSource as Ref<ValidRequestSource>;
  const validRequestTarget = requestTarget as Ref<ValidRequestTarget>;

  const transfer = await createTransfer(
    validRequestSource,
    validRequestTarget,
    getTokenForChain(
      validRequestTarget.value.targetChain.value.identifier,
      validRequestSource.value.token.label,
    ),
  );

  transferHistory.addTransfer(transfer);
  switchToActivities();

  await executeTransfer(signer, signerAddress, transfer);

  transferHistory.addTransfer(transfer);
  switchToActivities();
  resetForm();
  // Todo: reset validation
};

function resetForm() {
  requestSource.value = EMPTY_SOURCE_DATA;
  requestTarget.value = {
    ...EMPTY_TARGET_DATA,
    toAddress: requestTarget.value.toAddress === signerAddress.value ? signerAddress.value : '',
  };
}

watch(chainId, (_, oldChainId) => {
  if (oldChainId !== -1) {
    location.reload();
  }
});

watch(signerAddress, (currSignerAddress, prevSignerAddress) => {
  const toAddress = requestTarget.value.toAddress;

  if (!toAddress || toAddress === prevSignerAddress) {
    requestTarget.value = { ...requestTarget.value, toAddress: currSignerAddress ?? '' };
  }
});

const checkboxClasses = `appearance-none h-7 w-7 bg-sea-green shadow-inner rounded-md 
hover:opacity-90 
checked:after:text-teal checked:after:text-4xl checked:after:leading-7`;
</script>

<script lang="ts">
export default {
  // Necessary because the fallthrough attributes from Tabs should not be used in this component
  inheritAttrs: false,
};
</script>
