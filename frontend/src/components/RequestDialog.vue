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
      <RequestFormInputs />

      <Teleport v-if="signer" to="#action-button-portal">
        <FormKit
          class="w-72 flex flex-row justify-center bg-green"
          type="submit"
          :disabled="!valid"
          @click="submitForm"
        >
          Transfer funds
        </FormKit>
      </Teleport>
    </FormKit>
  </div>
</template>

<script setup lang="ts">
import { FormKitFrameworkContext } from '@formkit/core';
import { FormKit } from '@formkit/vue';
import { storeToRefs } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';

import { Transfer } from '@/actions/transfers';
import RequestFormInputs from '@/components/RequestFormInputs.vue';
import { useRequestFee } from '@/composables/useRequestFee';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useTransferHistory } from '@/stores/transfer-history';
import type { ChainWithTokens } from '@/types/config';
import type { Chain, Token } from '@/types/data';
import type { RequestFormResult } from '@/types/form';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { provider, signer, signerAddress, chainId } = storeToRefs(ethereumProvider);
const transferHistory = useTransferHistory();

const requestForm = ref<FormKitFrameworkContext>();

const requestManagerAddress = computed(
  () => configuration.chains[chainId.value]?.requestManagerAddress,
);

const { amount: fees } = useRequestFee(provider, requestManagerAddress);

const submitForm = () => {
  requestForm.value?.node.submit();
};

const submitRequestTransaction = async (formResult: RequestFormResult) => {
  if (!provider.value || !signer.value) {
    throw new Error('No signer available!');
  }
  const sourceConfiguration = configuration.chains[formResult.sourceChainId.value];
  const sourceChain = parseChainFromConfiguration(sourceConfiguration);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sourceToken = parseTokenFromChainConfiguration(
    sourceConfiguration,
    formResult.tokenAddress.label,
  )!;
  const sourceAmount = TokenAmount.parse(formResult.amount, sourceToken);

  const targetConfiguration = configuration.chains[formResult.targetChainId.value];
  const targetChain = parseChainFromConfiguration(targetConfiguration);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const targetToken = parseTokenFromChainConfiguration(
    targetConfiguration,
    formResult.tokenAddress.label,
  )!;
  const targetAmount = TokenAmount.parse(formResult.amount, targetToken);
  const validityPeriod = new UInt256('600');

  const transfer = reactive(
    Transfer.new(
      sourceChain,
      sourceAmount,
      targetChain,
      targetAmount,
      formResult.toAddress,
      validityPeriod,
      fees.value as TokenAmount,
    ),
  ) as Transfer;

  transferHistory.addTransfer(transfer);
  requestForm.value?.node.reset();

  try {
    await transfer.execute(signer.value, signerAddress.value);
  } catch (error) {
    console.error(error);
    console.log(transfer);
  }
};

function parseChainFromConfiguration(configuration: ChainWithTokens): Chain {
  return {
    identifier: configuration.identifier,
    name: configuration.name,
    rpcUrl: configuration.rpcUrl,
    requestManagerAddress: configuration.requestManagerAddress,
    fillManagerAddress: configuration.fillManagerAddress,
    explorerTransactionUrl: configuration.explorerTransactionUrl,
  };
}

function parseTokenFromChainConfiguration(
  configuration: ChainWithTokens,
  tokenName: string,
): Token | undefined {
  return configuration.tokens.find((token) => token.symbol === tokenName);
}

watch(chainId, (_, oldChainId) => {
  if (oldChainId !== -1) {
    location.reload();
  }
});
</script>
