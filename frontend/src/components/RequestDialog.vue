<template>
  <div class="request-dialog">
    <RequestFormInputs v-model="formResult" />

    <Teleport v-if="signer" to="#action-button-portal">
      <ActionButton
        v-if="transferFundsButtonVisible"
        :disabled="!formValid"
        @click="submitRequestTransaction"
      >
        Transfer Funds
      </ActionButton>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { computed, reactive, ref, watch } from 'vue';

import { Transfer } from '@/actions/transfers';
import ActionButton from '@/components/layout/ActionButton.vue';
import RequestFormInputs from '@/components/RequestFormInputs.vue';
import { useToggleOnActivation } from '@/composables/useToggleOnActivation';
import { switchToActivities } from '@/router/navigation';
import { getRequestFee } from '@/services/transactions/request-manager';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useTransferHistory } from '@/stores/transfer-history';
import type { ChainWithTokens } from '@/types/config';
import type { Token } from '@/types/data';
import type { RequestFormResult, ValidRequestFormResult } from '@/types/form';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { signer, signerAddress, chainId } = storeToRefs(ethereumProvider);
const transferHistory = useTransferHistory();
const { activated: transferFundsButtonVisible } = useToggleOnActivation();

const formResult: Ref<RequestFormResult> = ref({
  amount: '',
  sourceChain: null,
  targetChain: null,
  toAddress: '',
  token: null,
});

const formValid = computed(() => checkFormValidity(formResult.value));

const submitRequestTransaction = async () => {
  if (!signer.value) {
    throw new Error('No signer available!');
  }
  if (!checkFormValidity(formResult.value)) {
    throw new Error('Form not valid!');
  }

  const sourceAmount = TokenAmount.parse(formResult.value.amount, formResult.value.token.value);

  const targetConfiguration = configuration.chains[formResult.value.targetChain.value.identifier];
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const targetToken = parseTokenFromChainConfiguration(
    targetConfiguration,
    formResult.value.token.label,
  )!;
  const targetAmount = TokenAmount.parse(formResult.value.amount, targetToken);
  const validityPeriod = new UInt256('600');
  const { rpcUrl, requestManagerAddress } = formResult.value.sourceChain.value;
  const requestFee = await getRequestFee(rpcUrl, requestManagerAddress, targetAmount.uint256);
  const fees = TokenAmount.new(requestFee, sourceAmount.token);

  const transfer = reactive(
    Transfer.new(
      formResult.value.sourceChain.value,
      sourceAmount,
      formResult.value.targetChain.value,
      targetAmount,
      formResult.value.toAddress,
      validityPeriod,
      fees,
    ),
  ) as Transfer;

  transferHistory.addTransfer(transfer);
  switchToActivities();
  formResult.value = {
    amount: '',
    sourceChain: null,
    targetChain: null,
    toAddress: '',
    token: null,
  };

  try {
    await transfer.execute(signer.value, signerAddress.value);
  } catch (error) {
    console.error(error);
    console.log(transfer);
  }
};

function checkFormValidity(formData: RequestFormResult): formData is ValidRequestFormResult {
  return Object.values(formData).every((value) => !!value);
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
