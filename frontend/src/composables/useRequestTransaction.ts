import { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber } from 'ethers'
import { Ref, ref, ShallowRef } from 'vue';

import { getRequestFee, sendRequestTransaction } from '@/services/transactions/request-manager';
import { registerFillListener } from '@/services/transactions/fill-manager';
import { ensureTokenAllowance } from '@/services/transactions/token';
import { EthereumProvider } from '@/services/web3-provider';
import { RaisyncConfig } from '@/types/config';
import { Request, RequestState } from '@/types/data';
import createAsyncProcess from '@/utils/create-async-process';


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function useGetFee(
  ethereumProvider: ShallowRef<Readonly<EthereumProvider>>,
  raisyncConfig: Ref<Readonly<RaisyncConfig>>,
) {
  const getFeeError = ref('');
  const fee = ref<number>();

  const getFee = async (
    request: Request,
    signer: JsonRpcSigner,
  ) => {
    getFeeError.value = '';

    try {
      const chainId = ethereumProvider.value.chainId.value;
      const chainConfig = raisyncConfig.value.chains[String(chainId)];
      request.requestManagerAddress = chainConfig.requestManagerAddress

      const res = await getRequestFee(
        signer,
        request
      );
      fee.value = res;

    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        getFeeError.value = error.message;
      } else {
        getFeeError.value = 'Unknown failure.';
      }
    }
  };

  const { active: getFeeActive, run: runExecuteGetFee } =
    createAsyncProcess(getFee);
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
  raisyncConfig: Ref<Readonly<RaisyncConfig>>,
) {
  const transactionError = ref('');
  const requestState = ref<RequestState>(RequestState.WaitConfirm);

  const executeRequestTransaction = async (
    request: Request,
    signer: JsonRpcSigner,
  ) => {
    transactionError.value = '';

    try {
      const chainId = ethereumProvider.value.chainId.value;
      const chainConfig = raisyncConfig.value.chains[String(chainId)];
      request.requestManagerAddress = chainConfig.requestManagerAddress;
      await ensureTokenAllowance(
        signer,
        request.sourceTokenAddress,
        request.requestManagerAddress,
        request.amount,
      );

      // Modified Request with additional information based
      // on tx-receipt values and fee calculation
      // TODO make sure this really mutates the state of the request obj
      await sendRequestTransaction(
        signer,
        request,
	requestState,
      );
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
    requestState,
    transactionError,
    getRequestFee,
    executeRequestTransaction: runExecuteRequestTransaction,
  };
}

export function useWaitRequestFilled(
  ethereumProvider: ShallowRef<Readonly<EthereumProvider>>,
  raisyncConfig: Ref<Readonly<RaisyncConfig>>,
) {

  const waitError = ref('');

  const executeWaitFulfilled = async (
    request: Request,
    requestState: Ref<RequestState>,
    signer: JsonRpcSigner,
  ) => {
    waitError.value = '';

    try {
      await ethereumProvider.value.switchChain(BigNumber.from(request.targetChainId));
      // TODO make sure the chain is switched 
      const chainId = ethereumProvider.value.chainId.value;

      const chainConfig = raisyncConfig.value.chains[String(chainId)];
      request.fillManagerAddress = chainConfig.fillManagerAddress;
      registerFillListener(
	      signer,
	      request,
	      requestState,
      )

      requestState.value = RequestState.WaitFulfill
      // TODO query for the RequestFilled event


    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        waitError.value = error.message;
      } else {
        waitError.value = 'Unknown failure.';
      }
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

