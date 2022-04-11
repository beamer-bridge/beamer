import { JsonRpcSigner } from '@ethersproject/providers';
import { ethers } from 'ethers';
import { Ref, ref, ShallowRef } from 'vue';

import { listenOnFulfillment } from '@/services/transactions/fill-manager';
import { getRequestFee, sendRequestTransaction } from '@/services/transactions/request-manager';
import { ensureTokenAllowance, getTokenDecimals } from '@/services/transactions/token';
import { EthereumProvider } from '@/services/web3-provider';
import { BeamerConfig } from '@/types/config';
import { Request, RequestState } from '@/types/data';
import createAsyncProcess from '@/utils/create-async-process';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function useGetFee(
  ethereumProvider: ShallowRef<Readonly<EthereumProvider>>,
  beamerConfig: Ref<Readonly<BeamerConfig>>,
) {
  const getFeeError = ref('');
  const fee = ref<number>();

  const getFee = async () => {
    getFeeError.value = '';

    try {
      const chainId = ethereumProvider.value.chainId.value;
      const chainConfig = beamerConfig.value.chains[String(chainId)];
      const requestManagerAddress = chainConfig?.requestManagerAddress;
      if (requestManagerAddress) {
        const res = await getRequestFee(ethereumProvider.value, requestManagerAddress);
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

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function useRequestTransaction(
  ethereumProvider: ShallowRef<Readonly<EthereumProvider>>,
  beamerConfig: Ref<Readonly<BeamerConfig>>,
) {
  const requestState = ref<RequestState>(RequestState.Init);

  const executeRequestTransaction = async (request: Request, signer: JsonRpcSigner) => {
    requestState.value = RequestState.WaitConfirm;

    try {
      const chainId = ethereumProvider.value.chainId.value;
      const chainConfig = beamerConfig.value.chains[String(chainId)];
      request.sourceChainId = chainId;
      request.requestManagerAddress = chainConfig.requestManagerAddress;
      const decimals = await getTokenDecimals(signer, request.sourceTokenAddress);
      request.amount = ethers.utils.parseUnits(request.amount.toString(), decimals);

      await ensureTokenAllowance(
        signer,
        request.sourceTokenAddress,
        request.requestManagerAddress,
        request.amount,
      );

      await sendRequestTransaction(signer, request, requestState);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else if (error.code && error.code === 4001) {
        throw new Error('Error: User rejected the transaction!');
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

export function useWaitRequestFilled(beamerConfig: Ref<Readonly<BeamerConfig>>) {
  const waitError = ref('');

  const executeWaitFulfilled = async (request: Request, requestState: Ref<RequestState>) => {
    waitError.value = '';

    const targetChainId = request.targetChainId;
    const targetChainConfig = beamerConfig.value.chains[String(targetChainId)];
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
      console.log(error);
      requestState.value = RequestState.RequestFailed;
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
