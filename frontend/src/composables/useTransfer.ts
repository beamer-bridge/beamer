import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';
import { ethers } from 'ethers';
import { computed, ref } from 'vue';

import { waitForRequestFulfillment } from '@/services/transactions/fill-manager';
import { sendRequestTransaction } from '@/services/transactions/request-manager';
import { ensureTokenAllowance, getTokenDecimals } from '@/services/transactions/token';
import type { EthereumProvider } from '@/services/web3-provider';
import { ChainConfigMapping } from '@/types/config';
import type { Request, RequestMetadata } from '@/types/data';
import { RequestState } from '@/types/data';
import { RequestFormResult } from '@/types/form';

export function useTransfer() {
  const error = ref<string | undefined>(undefined);
  const requestState = ref<RequestState>(RequestState.Init);
  const requestMetadata = ref<RequestMetadata>();

  const runTransfer = async (
    formResult: RequestFormResult,
    provider: EthereumProvider,
    signer: JsonRpcSigner,
    requestManagerAddress: string,
    requestFeeAmount: number,
    chains: ChainConfigMapping,
  ) => {
    error.value = '';
    requestMetadata.value = {
      tokenSymbol: formResult.tokenAddress.label,
      sourceChainName: formResult.sourceChainId.label,
      targetChainName: formResult.targetChainId.label,
      targetAddress: formResult.toAddress,
      amount: formResult.amount,
    };
    requestState.value = RequestState.WaitConfirm;

    try {
      const decimals = await getTokenDecimals(provider, formResult.tokenAddress.value);
      const request: Request = {
        targetChainId: Number(formResult.targetChainId.value),
        sourceTokenAddress: formResult.tokenAddress.value,
        sourceChainId: provider.chainId.value,
        targetTokenAddress: getTargetTokenAddress(
          formResult.targetChainId.value,
          formResult.tokenAddress.label,
          chains,
        ),
        targetAddress: formResult.toAddress,
        amount: ethers.utils.parseUnits(formResult.amount, decimals),
        requestManagerAddress: requestManagerAddress,
        fee: requestFeeAmount,
      };

      const targetChainRpcUrl = chains[formResult.targetChainId.value].rpcUrl;
      const targetChainProvider = new JsonRpcProvider(targetChainRpcUrl);
      const fillManagerAddress = chains[formResult.targetChainId.value].fillManagerAddress;

      await ensureTokenAllowance(
        signer,
        request.sourceTokenAddress,
        request.requestManagerAddress,
        request.amount,
      );
      await sendRequestTransaction(provider, signer, request, requestState);
      await waitForRequestFulfillment(
        targetChainProvider,
        fillManagerAddress,
        request,
        requestState,
      );
    } catch (exception) {
      error.value = getTransactionErrorMessage(exception);
    }
  };

  const isNewTransferDisabled = computed(() => {
    return (
      requestState.value !== RequestState.RequestSuccessful &&
      requestState.value !== RequestState.RequestFailed
    );
  });

  return {
    runTransfer,
    requestMetadata,
    error,
    requestState,
    isNewTransferDisabled,
  };
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

function getTargetTokenAddress(
  targetChainId: number,
  tokenSymbol: string,
  chains: ChainConfigMapping,
) {
  return chains[targetChainId].tokens.find((token) => token.symbol === tokenSymbol)
    ?.address as string;
}
