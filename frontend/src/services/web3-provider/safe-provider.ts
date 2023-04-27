import type { SafeInfo } from '@safe-global/safe-apps-sdk';

import { BasicEthereumProvider } from '@/services/web3-provider';
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

export class SafeProvider extends BasicEthereumProvider {
  constructor(safe: SafeInfo, sdk: SafeAppsSDK) {
    super(new SafeAppProvider(safe, sdk));
  }
}
