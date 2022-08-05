import type { JsonRpcSigner } from '@ethersproject/providers';
import type { Ref } from 'vue';
import { reactive, ref } from 'vue';

import { Transfer } from '@/actions/transfers';
import { getRequestFee } from '@/services/transactions/request-manager';
import type { Token } from '@/types/data';
import type { ValidRequestSource, ValidRequestTarget } from '@/types/form';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export function useTransferRequest() {
  const executing = ref(false);
  const creating = ref(false);

  // TODO: separate params instead of using complete objects
  const create = async (
    requestSource: Ref<ValidRequestSource>,
    requestTarget: Ref<ValidRequestTarget>,
    targetToken: Token | undefined,
  ) => {
    creating.value = true;

    const sourceAmount = TokenAmount.parse(
      requestSource.value.amount,
      requestSource.value.token.value,
    );
    const targetAmount = TokenAmount.parse(requestSource.value.amount, targetToken);

    const validityPeriod = new UInt256('600');
    const { rpcUrl, requestManagerAddress } = requestSource.value.sourceChain.value;
    const requestFee = await getRequestFee(rpcUrl, requestManagerAddress, targetAmount.uint256);
    const fees = TokenAmount.new(requestFee, sourceAmount.token);

    const transfer = reactive(
      Transfer.new(
        requestSource.value.sourceChain.value,
        sourceAmount,
        requestTarget.value.targetChain.value,
        targetAmount,
        requestTarget.value.toAddress,
        validityPeriod,
        fees,
      ),
    ) as Transfer;

    creating.value = false;

    return transfer;
  };

  const execute = async (
    signer: Ref<JsonRpcSigner | undefined>,
    signerAddress: Ref<string>,
    transfer: Transfer,
  ) => {
    executing.value = true;

    if (!signer.value) {
      executing.value = false;
      throw new Error('No signer available!');
    }

    try {
      await transfer.execute(signer.value, signerAddress.value);
    } catch (error) {
      console.error(error);
      console.log(transfer);
    } finally {
      executing.value = false;
    }
  };

  return { create, execute, creating, executing };
}
