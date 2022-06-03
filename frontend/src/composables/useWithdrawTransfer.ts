import type { Transfer } from '@/actions/transfers';
import { useAsynchronousTask } from '@/composables/useAsynchronousTask';
import type { EthereumProvider } from '@/services/web3-provider';

async function withdrawTransfer(transfer: Transfer, provider: EthereumProvider): Promise<void> {
  await transfer.withdraw(provider);
}

export function useWithdrawTransfer() {
  return useAsynchronousTask(withdrawTransfer);
}
