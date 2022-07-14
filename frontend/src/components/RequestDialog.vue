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
    <ActionButton
      v-if="transferFundsButtonVisible"
      :disabled="!formValid"
      @click="submitRequestTransaction"
    >
      Transfer Funds
    </ActionButton>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import { computed, reactive, ref, watch } from 'vue';

import { Transfer } from '@/actions/transfers';
import ActionButton from '@/components/layout/ActionButton.vue';
import RequestSourceInputs from '@/components/RequestSourceInputs.vue';
import RequestTargetInputs from '@/components/RequestTargetInputs.vue';
import { useToggleOnActivation } from '@/composables/useToggleOnActivation';
import { switchToActivities } from '@/router/navigation';
import { getRequestFee } from '@/services/transactions/request-manager';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { useTransferHistory } from '@/stores/transfer-history';
import type { ChainWithTokens } from '@/types/config';
import type { Token } from '@/types/data';
import type {
  RequestSource,
  RequestTarget,
  ValidRequestSource,
  ValidRequestTarget,
} from '@/types/form';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

const EMPTY_SOURCE_DATA: RequestSource = {
  amount: '',
  sourceChain: null,
  token: null,
};
const EMPTY_TARGET_DATA: RequestTarget = {
  targetChain: null,
  toAddress: '',
};

const configuration = useConfiguration();
const ethereumProvider = useEthereumProvider();
const { signer, signerAddress, chainId } = storeToRefs(ethereumProvider);
const transferHistory = useTransferHistory();
const { activated: transferFundsButtonVisible } = useToggleOnActivation();

const requestSource: Ref<RequestSource> = ref(EMPTY_SOURCE_DATA);
const requestTarget: Ref<RequestTarget> = ref(EMPTY_TARGET_DATA);

const formValid = computed(
  () => checkSourceValidity(requestSource.value) && checkTargetValidity(requestTarget.value),
);

const submitRequestTransaction = async () => {
  if (!signer.value) {
    throw new Error('No signer available!');
  }
  if (!checkSourceValidity(requestSource.value) || !checkTargetValidity(requestTarget.value)) {
    throw new Error('Form not valid!');
  }

  const sourceAmount = TokenAmount.parse(
    requestSource.value.amount,
    requestSource.value.token.value,
  );

  const targetConfiguration =
    configuration.chains[requestTarget.value.targetChain.value.identifier];
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const targetToken = parseTokenFromChainConfiguration(
    targetConfiguration,
    requestSource.value.token.label,
  )!;
  const targetAmount = TokenAmount.parse(requestSource.value.amount, targetToken);
  const validityPeriod = new UInt256('600');
  const { rpcUrl, requestManagerAddress } = requestSource.value.sourceChain.value;
  const requestFee = await getRequestFee(rpcUrl, requestManagerAddress, targetAmount.uint256);
  const fees = TokenAmount.new(requestFee, sourceAmount.token);

  const transfer = reactive(
    Transfer.new(
      requestSource.value.sourceChain.value,
      sourceAmount,
      requestTarget.value.targetChain.value,
      targetAmount,
      requestTarget.value.toAddress,
      validityPeriod,
      fees,
    ),
  ) as Transfer;

  transferHistory.addTransfer(transfer);
  switchToActivities();
  resetForm();

  try {
    await transfer.execute(signer.value, signerAddress.value);
  } catch (error) {
    console.error(error);
    console.log(transfer);
  }
};

function checkSourceValidity(sourceData: RequestSource): sourceData is ValidRequestSource {
  return Object.values(sourceData).every((value) => !!value);
}
function checkTargetValidity(targetData: RequestTarget): targetData is ValidRequestTarget {
  return Object.values(targetData).every((value) => !!value);
}

function parseTokenFromChainConfiguration(
  configuration: ChainWithTokens,
  tokenName: string,
): Token | undefined {
  return configuration.tokens.find((token) => token.symbol === tokenName);
}

function resetForm() {
  requestSource.value = EMPTY_SOURCE_DATA;
  requestTarget.value = EMPTY_TARGET_DATA;
}

watch(chainId, (_, oldChainId) => {
  if (oldChainId !== -1) {
    location.reload();
  }
});
</script>

<script lang="ts">
export default {
  // Necessary because the fallthrough attributes from Tabs should not be used in this component
  inheritAttrs: false,
};
</script>
