import { InjectionKey, ShallowRef } from 'vue';

import { EthereumProvider } from './services/web3-provider';

export const EthereumProviderKey: InjectionKey<ShallowRef<Readonly<EthereumProvider>>> =
  Symbol('EthereumProvider');
