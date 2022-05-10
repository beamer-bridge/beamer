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
      <TransferStatus v-else :transfer="transfer!" />
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

import { Transfer } from '@/actions/transfer';
import RequestFormInputs from '@/components/RequestFormInputs.vue';
import TransferStatus from '@/components/TransferStatus.vue';
import { useRequestFee } from '@/composables/useRequestFee';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import type { RequestFormResult } from '@/types/form';

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { provider, signer, signerAddress, chainId } = storeToRefs(ethereumProvider);

const transfer = ref<Transfer | undefined>(undefined);
const requestForm = ref<FormKitFrameworkContext>();

const requestManagerAddress = computed(
  () => configuration.chains[chainId.value]?.requestManagerAddress,
);

const { amount: requestFeeAmount } = useRequestFee(provider, requestManagerAddress);

const submitForm = () => {
  requestForm.value?.node.submit();
};

const submitRequestTransaction = async (formResult: RequestFormResult) => {
  if (!provider.value || !signer.value) {
    throw new Error('No signer available!');
  }

  const sourceChainConfiguration = configuration.chains[formResult.sourceChainId.value];
  const sourceChain = {
    identifier: sourceChainConfiguration.identifier,
    name: sourceChainConfiguration.name,
    rpcUrl: sourceChainConfiguration.rpcUrl,
    requestManagerAddress: sourceChainConfiguration.requestManagerAddress,
    fillManagerAddress: sourceChainConfiguration.fillManagerAddress,
    explorerTransactionUrl: sourceChainConfiguration.explorerTransactionUrl,
  };
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sourceToken = sourceChainConfiguration.tokens.find(
    (token) => token.symbol === formResult.tokenAddress.label,
  )!;

  const targetChainConfiguration = configuration.chains[formResult.targetChainId.value];
  const targetChain = {
    identifier: targetChainConfiguration.identifier,
    name: targetChainConfiguration.name,
    rpcUrl: targetChainConfiguration.rpcUrl,
    requestManagerAddress: targetChainConfiguration.requestManagerAddress,
    fillManagerAddress: targetChainConfiguration.fillManagerAddress,
    explorerTransactionUrl: targetChainConfiguration.explorerTransactionUrl,
  };
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const targetToken = targetChainConfiguration.tokens.find(
    (token) => token.symbol === formResult.tokenAddress.label,
  )!;

  transfer.value = new Transfer({
    amount: Number(formResult.amount),
    sourceChain,
    sourceToken,
    targetChain,
    targetToken,
    targetAccount: formResult.toAddress,
    validityPeriod: 600,
    fees: requestFeeAmount.value,
  });

  try {
    await transfer.value.execute(signer.value, signerAddress.value);
  } catch (error) {
    console.error(error);
    console.log(transfer.value);
  }
};

watch(chainId, (_, oldChainId) => {
  if (oldChainId !== -1) {
    location.reload();
  }
});

const transferError = computed(() => transfer.value?.errorMessage);

const isTransferInProgress = computed(() => {
  return transfer.value && (transfer.value.active || transfer.value.done);
});

const isNewTransferDisabled = computed(() => {
  return transfer.value !== undefined && !transfer.value.done;
});

const newTransfer = () => {
  transfer.value = undefined;
};
</script>
