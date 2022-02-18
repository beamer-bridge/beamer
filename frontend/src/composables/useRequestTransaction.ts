import { JsonRpcSigner } from '@ethersproject/providers';
import { Ref, ref, ShallowRef } from 'vue';

import { sendRequestTransaction } from '@/services/transactions/request-manager';
import { ensureTokenAllowance } from '@/services/transactions/token';
import { EthereumProvider } from '@/services/web3-provider';
import { RaisyncConfig } from '@/types/config';
import { RequestFormResult } from '@/types/form';
import createAsyncProcess from '@/utils/create-async-process';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useRequestTransaction(
  ethereumProvider: ShallowRef<Readonly<EthereumProvider>>,
  raisyncConfig: Ref<Readonly<RaisyncConfig>>,
) {
  const transactionError = ref('');
  const successfulTransactionUrl = ref('');

  const executeRequestTransaction = async (
    formResult: RequestFormResult,
    signer: JsonRpcSigner,
  ) => {
    transactionError.value = '';

    try {
      const chainId = ethereumProvider.value.chainId.value;
      const chainConfig = raisyncConfig.value.chains[String(chainId)];
      const requestManagerAddress = chainConfig.requestManagerAddress;
      await ensureTokenAllowance(
        signer,
        formResult.sourceTokenAddress,
        requestManagerAddress,
        formResult.amount,
      );
      const transactionReceipt = await sendRequestTransaction(
        signer,
        requestManagerAddress,
        formResult.targetChainId,
        formResult.sourceTokenAddress,
        formResult.targetTokenAddress,
        formResult.targetAddress,
        formResult.amount,
      );
      successfulTransactionUrl.value =
        chainConfig.explorerTransactionUrl + transactionReceipt.transactionHash;
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        transactionError.value = error.message;
      } else {
        transactionError.value = 'Unknown failure.';
      }
    }
  };

  const { active: requestTransactionActive, run: runExecuteRequestTransaction } =
    createAsyncProcess(executeRequestTransaction);
  return {
    requestTransactionActive,
    transactionError,
    successfulTransactionUrl,
    executeRequestTransaction: runExecuteRequestTransaction,
  };
}
