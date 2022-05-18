export type Settings =
  | {
      connectedWallet: WalletType | undefined;
    }
  | undefined;

// Values must not be changed for backward compatibility
export enum WalletType {
  MetaMask = 'metamask',
  WalletConnect = 'wallet_connect',
}
