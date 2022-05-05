import type { JsonRpcProvider } from '@ethersproject/providers';
import type { Ref } from 'vue';
import { ref } from 'vue';

import { listenOnFulfillment } from '@/services/transactions/fill-manager';
import type { Request } from '@/types/data';
import { RequestState } from '@/types/data';

export function useWaitForRequestFulfillment() {
  const error = ref<string | undefined>(undefined);

  const waitForRequestFulfillment = async (
    provider: JsonRpcProvider, // TODO: This type is an exception till refactoring.
    fillManagerAddress: string,
    request: Request,
    requestState: Ref<RequestState>,
  ) => {
    error.value = undefined;
    requestState.value = RequestState.WaitFulfill;

    try {
      const currentBlockNumber = await provider.getBlockNumber();
      await listenOnFulfillment(provider, request, fillManagerAddress, currentBlockNumber);
    } catch (exception) {
      error.value = exception.message ?? exception;
      requestState.value = RequestState.RequestFailed;
    }

    requestState.value = RequestState.RequestSuccessful;
  };

  return { run: waitForRequestFulfillment };
}
