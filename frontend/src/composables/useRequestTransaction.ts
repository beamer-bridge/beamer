import { JsonRpcSigner } from '@ethersproject/providers';
import { ethers } from 'ethers';
import { ref } from 'vue';

import { sendRequestTransaction } from '@/services/transactions/request-manager';
import { ensureTokenAllowance, getTokenDecimals } from '@/services/transactions/token';
import type { EthereumProvider } from '@/services/web3-provider';
import type { Request } from '@/types/data';
import { RequestState } from '@/types/data';
import createAsyncProcess from '@/utils/create-async-process';

export function useRequestTransaction() {
  const error = ref<string | undefined>(undefined);
  const state = ref<RequestState>(RequestState.Init);

  const executeTransaction = async (
    provider: EthereumProvider,
    signer: JsonRpcSigner,
    requestManagerAddress: string,
    request: Request,
  ) => {
    error.value = undefined;
    state.value = RequestState.WaitConfirm;

    try {
      const decimals = await getTokenDecimals(provider, request.sourceTokenAddress);

      request.amount = ethers.utils.parseUnits(request.amount.toString(), decimals);
      request.sourceChainId = provider.chainId.value;
      request.requestManagerAddress = requestManagerAddress;

      await ensureTokenAllowance(
        signer,
        request.sourceTokenAddress,
        request.requestManagerAddress,
        request.amount,
      );

      await sendRequestTransaction(provider, signer, request, state);
    } catch (exception) {
      error.value = getTransactionErrorMessage(exception);
    }
  };

  const { active, run } = createAsyncProcess(executeTransaction);
  return { run, active, error, state };
}

function getTransactionErrorMessage(error: unknown): string {
  const maybeErrorCode = (error as { code?: number }).code;

  // TODO move all custom errors to error handling library
  if (error instanceof Error) {
    return error.message;
  } else if (maybeErrorCode && maybeErrorCode === 4001) {
    return 'Error: User rejected the transaction!';
  } else if (maybeErrorCode && maybeErrorCode === -32603) {
    return 'Error: Insufficient balance!';
  } else {
    return 'Unknown failure!';
  }
}
