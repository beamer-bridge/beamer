/**
 * In order to achieve testability of our external wallet-provider implementations
 * we have to re-export some of their utility functions via named exports
 */
import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import detectEthereumProvider from '@metamask/detect-provider';
import MetaMaskOnboarding from '@metamask/onboarding';
import WalletConnect from '@walletconnect/ethereum-provider';

export { CoinbaseWalletSDK, detectEthereumProvider, MetaMaskOnboarding, WalletConnect };
