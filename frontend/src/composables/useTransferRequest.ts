import type { JsonRpcSigner } from '@ethersproject/providers';
import type { Ref } from 'vue';
import { reactive } from 'vue';

import { Transfer } from '@/actions/transfers';
import { useAsynchronousTask } from '@/composables/useAsynchronousTask';
import { getRequestFee } from '@/services/transactions/request-manager';
import type { Chain, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export function useTransferRequest() {
  const VALIDITY_PERIOD_SECONDS = import.meta.env.VITE_REQUEST_EXPIRY_SECONDS || '1800';

  const create = async (options: {
    sourceChain: Chain;
    sourceAmount: string;
    targetChain: Chain;
    toAddress: string;
    sourceToken: Token;
    targetToken: Token;
  }): Promise<Transfer> => {
    const sourceTokenAmount = TokenAmount.parse(options.sourceAmount, options.sourceToken);
    const targetTokenAmount = TokenAmount.parse(options.sourceAmount, options.targetToken);

    const validityPeriod = new UInt256(VALIDITY_PERIOD_SECONDS);
    const { rpcUrl, requestManagerAddress } = options.sourceChain;
    const requestFee = await getRequestFee(
      rpcUrl,
      requestManagerAddress,
      targetTokenAmount.uint256,
    );
    const fees = TokenAmount.new(requestFee, sourceTokenAmount.token);

    const transfer = reactive(
      Transfer.new(
        options.sourceChain,
        sourceTokenAmount,
        options.targetChain,
        targetTokenAmount,
        options.toAddress,
        validityPeriod,
        fees,
      ),
    ) as Transfer;

    return transfer;
  };

  const execute = async (
    signer: Ref<JsonRpcSigner | undefined>,
    signerAddress: Ref<string>,
    transfer: Transfer,
  ): Promise<void> => {
    if (!signer.value) {
      throw new Error('No signer available!');
    }

    try {
      await transfer.execute(signer.value, signerAddress.value);
    } catch (error) {
      console.error(error);
      console.log(transfer);
    }
  };

  const { active: createActive, run: createAsync } = useAsynchronousTask(create);
  const { active: executeActive, run: executeAsync } = useAsynchronousTask(execute);

  return {
    create: createAsync,
    execute: executeAsync,
    creating: createActive,
    executing: executeActive,
  };
}
