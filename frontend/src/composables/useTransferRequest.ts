import { reactive } from 'vue';

import { Transfer } from '@/actions/transfers';
import { useAsynchronousTask } from '@/composables/useAsynchronousTask';
import { getRequestFee } from '@/services/transactions/request-manager';
import type {
  Eip1193Provider,
  EthereumProvider,
  IEthereumProvider,
} from '@/services/web3-provider';
import type { Chain, EthereumAddress, Token } from '@/types/data';
import { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export function useTransferRequest() {
  const VALIDITY_PERIOD_SECONDS = import.meta.env.VITE_REQUEST_EXPIRY_SECONDS || '1800';

  const create = async (options: {
    sourceChain: Chain;
    sourceAmount: string;
    targetChain: Chain;
    toAddress: EthereumAddress;
    sourceToken: Token;
    targetToken: Token;
    approveInfiniteAmount: boolean;
    requestCreatorAddress: EthereumAddress;
  }): Promise<Transfer> => {
    const sourceTokenAmount = TokenAmount.parse(options.sourceAmount, options.sourceToken);
    const targetTokenAmount = TokenAmount.parse(options.sourceAmount, options.targetToken);
    const targetChainId = options.targetChain.identifier;

    const validityPeriod = new UInt256(VALIDITY_PERIOD_SECONDS);
    const { rpcUrl, requestManagerAddress } = options.sourceChain;
    const requestFee = await getRequestFee(
      rpcUrl,
      requestManagerAddress,
      sourceTokenAmount,
      targetChainId,
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
        options.approveInfiniteAmount,
        options.requestCreatorAddress,
      ),
    ) as Transfer;

    return transfer;
  };

  const execute = async (provider: IEthereumProvider, transfer: Transfer): Promise<void> => {
    if (!provider?.signer.value) {
      throw new Error('No signer available!');
    }
    await transfer.execute(provider);
  };

  const withdraw = async (
    transfer: Transfer,
    provider: EthereumProvider<Eip1193Provider>,
  ): Promise<void> => {
    await transfer.withdraw(provider);
  };

  const {
    active: createActive,
    run: createAsync,
    error: createError,
  } = useAsynchronousTask(create);
  const {
    active: executeActive,
    run: executeAsync,
    error: executeError,
  } = useAsynchronousTask(execute);
  const {
    active: withdrawActive,
    run: withdrawAsync,
    error: withdrawError,
  } = useAsynchronousTask(withdraw);

  return {
    create: createAsync,
    execute: executeAsync,
    withdraw: withdrawAsync,
    creating: createActive,
    executing: executeActive,
    withdrawing: withdrawActive,
    createError,
    executeError,
    withdrawError,
  };
}
