import { JsonRpcSigner } from '@ethersproject/providers';
import { ethers } from 'ethers';
import { Ref, ref } from 'vue';

import { listenOnFulfillment } from '@/services/transactions/fill-manager';
import { getRequestFee, sendRequestTransaction } from '@/services/transactions/request-manager';
import { ensureTokenAllowance, getTokenDecimals } from '@/services/transactions/token';
import { useConfiguration } from '@/stores/configuration';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { Request, RequestState } from '@/types/data';
import createAsyncProcess from '@/utils/create-async-process';

export function useGetFee() {
  const getFeeError = ref('');
  const fee = ref<number>();

  const getFee = async () => {
    getFeeError.value = '';

    try {
      const configuration = useConfiguration();
      const ethereumProvider = useEthereumProvider();
      const chainConfig = configuration.chains[String(ethereumProvider.chainId)];
      const requestManagerAddress = chainConfig?.requestManagerAddress;
      if (requestManagerAddress) {
        const res = await getRequestFee(requestManagerAddress);
        fee.value = res;
      }
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        getFeeError.value = error.message;
      } else {
        getFeeError.value = 'Unknown failure.';
      }
    }
  };

  const { active: getFeeActive, run: runExecuteGetFee } = createAsyncProcess(getFee);
  return {
    fee,
    getFeeActive,
    getFeeError,
    executeGetFee: runExecuteGetFee,
  };
}

export function useRequestTransaction() {
  const requestState = ref<RequestState>(RequestState.Init);

  const executeRequestTransaction = async (request: Request, signer: JsonRpcSigner) => {
    requestState.value = RequestState.WaitConfirm;

    try {
      const configuration = useConfiguration();
      const ethereumProvider = useEthereumProvider();
      const chainConfig = configuration.chains[String(ethereumProvider.chainId)];
      request.sourceChainId = ethereumProvider.chainId;
      request.requestManagerAddress = chainConfig.requestManagerAddress;
      const decimals = await getTokenDecimals(request.sourceTokenAddress);
      request.amount = ethers.utils.parseUnits(request.amount.toString(), decimals);

      await ensureTokenAllowance(
        request.sourceTokenAddress,
        request.requestManagerAddress,
        request.amount,
      );

      await sendRequestTransaction(signer, request, requestState);
    } catch (error) {
      const maybeErrorCode = (error as { code?: number }).code;
      // TODO move all custom errors to error handling library
      if (error instanceof Error) {
        throw error;
      } else if (maybeErrorCode && maybeErrorCode === 4001) {
        throw new Error('Error: User rejected the transaction!');
      } else if (maybeErrorCode && maybeErrorCode === -32603) {
        throw new Error('Error: Insufficient balance!');
      } else {
        throw new Error('Unknown failure!');
      }
    }
  };

  const { active: requestTransactionActive, run: runExecuteRequestTransaction } =
    createAsyncProcess(executeRequestTransaction);
  return {
    requestTransactionActive,
    requestState,
    getRequestFee,
    executeRequestTransaction: runExecuteRequestTransaction,
  };
}

export function useWaitRequestFilled() {
  const waitError = ref('');

  const executeWaitFulfilled = async (request: Request, requestState: Ref<RequestState>) => {
    waitError.value = '';

    const targetChainId = request.targetChainId;
    const configuration = useConfiguration();
    const targetChainConfig = configuration.chains[String(targetChainId)];
    const fillManagerAddress = targetChainConfig.fillManagerAddress;

    const waitOnFulfillment = async () => {
      requestState.value = RequestState.WaitFulfill;
      const targetNetworkProvider = new ethers.providers.JsonRpcProvider(targetChainConfig.rpcUrl);
      const currentBlockNumber = await targetNetworkProvider.getBlockNumber();

      await listenOnFulfillment(
        targetNetworkProvider,
        request,
        fillManagerAddress,
        currentBlockNumber,
      );
    };

    try {
      await waitOnFulfillment();
      requestState.value = RequestState.RequestSuccessful;
    } catch (error) {
      requestState.value = RequestState.RequestFailed;
      throw error;
    }
  };

  const { active: waitFulfilledActive, run: runExecuteWaitFulfilled } =
    createAsyncProcess(executeWaitFulfilled);
  return {
    waitFulfilledActive,
    waitError,
    executeWaitFulfilled: runExecuteWaitFulfilled,
  };
}
