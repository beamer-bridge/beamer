/**
 * In order to achieve testability of our external wallet-provider implementations
 * we have to re-export some of their utility functions via named exports
 */
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import detectEthereumProvider from '@metamask/detect-provider';
import MetaMaskOnboarding from '@metamask/onboarding';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore TODO: Install & use type declarations once we migrate to WalletConnect v2
import WalletConnect from '@walletconnect/web3-provider/dist/umd/index.min.js';

export { CoinbaseWalletSDK, detectEthereumProvider, MetaMaskOnboarding, WalletConnect };
