import type { JsonRpcProvider } from '@ethersproject/providers';
import type { Ref } from 'vue';
import { ref } from 'vue';

import { listenOnFulfillment } from '@/services/transactions/fill-manager';
import type { Request } from '@/types/data';
import { RequestState } from '@/types/data';
import createAsyncProcess from '@/utils/create-async-process';

export function useWaitForRequestFulfilment() {
  const error = ref<string | undefined>(undefined);

  const waitForRequestFulfilment = async (
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

  const { active, run } = createAsyncProcess(waitForRequestFulfilment);
  return { run, active, error };
}
