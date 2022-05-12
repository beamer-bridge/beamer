<template>
  <div class="request-dialog px-20 pt-18 pb-16">
    <FormKit
      ref="requestForm"
      v-slot="{ state: { valid } }"
      form-class="flex flex-col items-center"
      type="form"
      :actions="false"
      @submit="submitRequestTransaction"
    >
      <RequestFormInputs v-if="requestState === RequestState.Init" />
      <RequestStatus v-else :metadata="requestMetadata!" :state="requestState" />
      <Transition name="expand">
        <div v-if="shownError" class="mt-7 text-right text-lg text-orange-dark">
          {{ shownError }}
        </div>
      </Transition>

      <Teleport to="#action-button-portal">
        <div v-if="!signer">
          <FormKit
            input-class="w-112 bg-orange flex flex-row justify-center"
            type="button"
            @click="runRequestSigner"
          >
            <div v-if="requestSignerActive" class="h-8 w-8">
              <spinner></spinner>
            </div>
            <template v-else>Connect MetaMask Wallet</template>
          </FormKit>
        </div>
        <div v-else>
          <FormKit
            v-if="requestState === RequestState.Init"
            class="w-72 flex flex-row justify-center bg-green"
            type="submit"
            :disabled="!valid"
            @click="submitForm"
          >
            Transfer funds
          </FormKit>

          <FormKit
            v-if="requestState !== RequestState.Init"
            input-class="w-72 flex flex-row justify-center bg-green"
            type="button"
            :disabled="isNewTransferDisabled"
            @click="newTransfer"
            >New Transfer</FormKit
          >
        </div>
      </Teleport>
    </FormKit>
  </div>
</template>

<script setup lang="ts">
import { FormKitFrameworkContext } from '@formkit/core';
import { FormKit } from '@formkit/vue';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import RequestFormInputs from '@/components/RequestFormInputs.vue';
import RequestStatus from '@/components/RequestStatus.vue';
import Spinner from '@/components/Spinner.vue';
import { useRequestFee } from '@/composables/useRequestFee';
import { useRequestSigner } from '@/composables/useRequestSigner';
import { useTransfer } from '@/composables/useTransfer';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { RequestState } from '@/types/data';
import type { RequestFormResult } from '@/types/form';

interface Emits {
  (e: 'reload'): void;
}

const emit = defineEmits<Emits>();

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { provider, signer, chainId } = storeToRefs(ethereumProvider);

const requestForm = ref<FormKitFrameworkContext>();

const requestManagerAddress = computed(
  () => configuration.chains[chainId.value]?.requestManagerAddress,
);

const { amount: requestFeeAmount } = useRequestFee(provider, requestManagerAddress);

const {
  run: requestSigner,
  active: requestSignerActive,
  error: requestSignerError,
} = useRequestSigner();

const {
  runTransfer,
  requestMetadata,
  error: transferError,
  requestState,
  isNewTransferDisabled,
} = useTransfer();

const runRequestSigner = () => {
  // TOOD: In future we will not separate getting provider and signer which
  // resolve the undefined provider case.
  if (provider.value) {
    requestSigner(provider.value);
  }
};

const submitForm = () => {
  requestForm.value?.node.submit();
};

const submitRequestTransaction = async (formResult: RequestFormResult) => {
  if (!provider.value || !signer.value) {
    throw new Error('No signer available!');
  }

  await runTransfer(
    formResult,
    provider.value,
    signer.value,
    requestManagerAddress.value,
    requestFeeAmount.value,
    configuration.chains,
  );
};

watch(chainId, () => location.reload());

const shownError = computed(() => {
  return requestSignerError.value || transferError.value;
});

watch(shownError, async () => {
  if (shownError.value && requestState.value !== RequestState.RequestFailed) {
    requestState.value = RequestState.Init;
  }
});

const newTransfer = () => {
  emit('reload');
};
</script>
