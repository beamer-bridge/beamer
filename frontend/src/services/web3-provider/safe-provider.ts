import type { SafeInfo } from '@safe-global/safe-apps-sdk';

import { BasicEthereumProvider } from '@/services/web3-provider/ethereum-provider';
import { SafeAppProvider, SafeAppsSDK } from '@/services/web3-provider/util-export';

export async function createSafeProvider(): Promise<SafeProvider | undefined> {
  const sdk = new SafeAppsSDK();
  // check if we're in an iframe
  if (window?.parent === window) {
    return undefined;
  }

  const safe = await Promise.race([
    sdk.safe.getInfo(),
    new Promise<undefined>((resolve) => setTimeout(resolve, 200)),
  ]);
  if (!safe) {
    return undefined;
  }

  const safeProvider = new SafeProvider(safe, sdk);
  await safeProvider.init();
  return safeProvider;
}

export class SafeProvider extends BasicEthereumProvider<SafeAppProvider> {
  disconnectable = false;
  isContractWallet = true;

  constructor(safe: SafeInfo, private sdk: SafeAppsSDK) {
    super(new SafeAppProvider(safe, sdk));
  }

  async waitForTransaction(
    internalTransactionHash: string,
    confirmations?: number,
    timeout?: number,
  ) {
    const receipt = await this.web3Provider.waitForTransaction(
      internalTransactionHash,
      confirmations,
      timeout,
    );

    if (receipt.status === 0) {
      throw new Error(`Transaction ${receipt.transactionHash} reverted on chain.`);
    }

    const transactionHash = await this.getActualTransactionHash(internalTransactionHash);

    return transactionHash;
  }

  async getActualTransactionHash(internalTransactionHash: string): Promise<string> {
    const transactionDetails = await this.sdk.txs.getBySafeTxHash(internalTransactionHash);
    const transactionHash = transactionDetails.txHash;

    if (transactionHash === undefined) {
      throw new Error('Transaction might not have been executed yet!');
    }

    return transactionHash;
  }
}
