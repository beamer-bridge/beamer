import { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber } from 'ethers';
import { Ref, ref, ShallowRef, watch } from 'vue';

import { listenOnFulfillment } from '@/services/transactions/fill-manager';
import { getRequestFee, sendRequestTransaction } from '@/services/transactions/request-manager';
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

  const getFee = async (signer: JsonRpcSigner) => {
    getFeeError.value = '';

    try {
      const chainId = ethereumProvider.value.chainId.value;
      const chainConfig = raisyncConfig.value.chains[String(chainId)];
      const requestManagerAddress = chainConfig.requestManagerAddress;

      const res = await getRequestFee(signer, requestManagerAddress);
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
  raisyncConfig: Ref<Readonly<RaisyncConfig>>,
) {
  const transactionError = ref('');
  const requestState = ref<RequestState>(RequestState.Init);

  const executeRequestTransaction = async (request: Request, signer: JsonRpcSigner) => {
    transactionError.value = '';
    requestState.value = RequestState.WaitConfirm;

    try {
      const chainId = ethereumProvider.value.chainId.value;
      const chainConfig = raisyncConfig.value.chains[String(chainId)];
      request.sourceChainId = chainId;
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
      await sendRequestTransaction(signer, request, requestState);
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
      const chainId = ethereumProvider.value.chainId.value;
      const chainConfig = raisyncConfig.value.chains[String(chainId)];
      request.fillManagerAddress = chainConfig.fillManagerAddress;
      requestState.value = RequestState.WaitSwitchChain;

      const waitOnFulfillment = async () => {
        requestState.value = RequestState.WaitFulfill;
        const { number: currentBlockNumber } = await ethereumProvider.value.getLatestBlock();
        await listenOnFulfillment(signer, request, currentBlockNumber);
        requestState.value = RequestState.RequestSuccessful;
      };

      if (ethereumProvider.value.chainId.value !== request.targetChainId) {
        const chainSwitched = new Promise((resolve) => {
          const stopWatch = watch(ethereumProvider.value.chainId, async (chainId) => {
            if (chainId === request.targetChainId) {
              stopWatch();
              resolve(undefined);
            }
          });
        });

        if (ethereumProvider.value.switchChain) {
          await ethereumProvider.value.switchChain(request.targetChainId);
        }
        if (ethereumProvider.value.chainId.value !== request.targetChainId) {
          requestState.value = RequestState.FailedSwitchChain;
        }

        await chainSwitched;
      }

      await waitOnFulfillment();
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
