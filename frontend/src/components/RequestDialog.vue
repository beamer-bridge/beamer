<template>
  <div class="request-dialog">
    <FormKit
      ref="requestForm"
      v-slot="{ state: { valid } }"
      form-class="flex flex-col items-center"
      type="form"
      :actions="false"
      @submit="submitRequestTransaction"
    >
      <RequestFormInputs v-if="!isTransferInProgress" />
      <TransferStatus v-else-if="transfer" :transfer="transfer" />
      <Transition name="expand">
        <div v-if="transferError" class="mt-7 text-right text-lg text-orange-dark">
          {{ transferError }}
        </div>
      </Transition>

      <Teleport v-if="signer" to="#action-button-portal">
        <FormKit
          v-if="!isTransferInProgress"
          class="w-72 flex flex-row justify-center bg-green"
          type="submit"
          :disabled="!valid"
          @click="submitForm"
        >
          Transfer funds
        </FormKit>

        <FormKit
          v-if="isTransferInProgress"
          input-class="w-72 flex flex-row justify-center bg-green"
          type="button"
          :disabled="isNewTransferDisabled"
          @click="newTransfer"
          >New Transfer</FormKit
        >
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
import TransferStatus from '@/components/TransferStatus.vue';
import { useRequestFee } from '@/composables/useRequestFee';
import { useTransfer } from '@/composables/useTransfer';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import type { RequestFormResult } from '@/types/form';

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { provider, signer, signerAddress, chainId } = storeToRefs(ethereumProvider);

const requestForm = ref<FormKitFrameworkContext>();

const requestManagerAddress = computed(
  () => configuration.chains[chainId.value]?.requestManagerAddress,
);

const { amount: fees } = useRequestFee(provider, requestManagerAddress);

const submitForm = () => {
  requestForm.value?.node.submit();
};

const { transfer, runTransfer, isTransferInProgress, isNewTransferDisabled } = useTransfer();

const submitRequestTransaction = async (formResult: RequestFormResult) => {
  if (!provider.value || !signer.value) {
    throw new Error('No signer available!');
  }
  await runTransfer(
    formResult,
    signer.value,
    signerAddress.value,
    fees.value,
    configuration.chains,
  );
};

watch(chainId, (_, oldChainId) => {
  if (oldChainId !== -1) {
    location.reload();
  }
});

const transferError = computed(() => transfer.value?.errorMessage);

const newTransfer = () => {
  transfer.value = undefined;
};
</script>
