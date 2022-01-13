import { JsonRpcSigner } from '@ethersproject/providers';
import { ref, ShallowRef } from 'vue';

import { sendRequestTransaction } from '@/services/transactions/request-manager';
import { ensureTokenAllowance } from '@/services/transactions/token';
import { EthereumProvider } from '@/services/web3-provider';
import { RequestFormResult } from '@/types/form';

async function getSignerStrictly(ethereumProvider: EthereumProvider): Promise<JsonRpcSigner> {
  if (ethereumProvider.signer) {
    return ethereumProvider.signer;
  }
  await ethereumProvider.requestSigner();
  if (!ethereumProvider.signer) {
    throw Error('Accessing wallet failed!');
  }
  return ethereumProvider.signer;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useRequestTransaction(
  ethereumProvider: ShallowRef<Readonly<EthereumProvider>>,
) {
  const executingRequest = ref(false);
  const transactionErrorMessage = ref('');
  const successfulTransactionUrl = ref('');

  const executeRequestTransaction = async (formResult: RequestFormResult) => {
    executingRequest.value = true;
    transactionErrorMessage.value = '';

    try {
      const signer = await getSignerStrictly(ethereumProvider.value);
      await ensureTokenAllowance(signer, formResult.sourceTokenAddress, formResult.amount);
      const transactionReceipt = await sendRequestTransaction(
        signer,
        formResult.targetChainId,
        formResult.sourceTokenAddress,
        formResult.targetTokenAddress,
        formResult.targetAddress,
        formResult.amount,
      );
      successfulTransactionUrl.value =
        process.env.VUE_APP_ETHERSCAN_TX_URL + transactionReceipt.transactionHash;
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        transactionErrorMessage.value = error.message;
      } else {
        transactionErrorMessage.value = 'Unknown failure.';
      }
    }

    executingRequest.value = false;
  };

  return {
    executingRequest,
    transactionErrorMessage,
    successfulTransactionUrl,
    executeRequestTransaction,
  };
}
