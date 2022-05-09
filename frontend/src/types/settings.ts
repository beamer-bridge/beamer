export type Settings =
  | {
      connectedWallet: WalletType | undefined;
    }
  | undefined;

// Values must not be changed for backward compatibility
export enum WalletType {
  Metamask = 'metamask',
  WalletConnect = 'wallet_connect',
}
