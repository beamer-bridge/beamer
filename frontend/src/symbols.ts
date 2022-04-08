import { InjectionKey, Ref, ShallowRef } from 'vue';

import { EthereumProvider } from './services/web3-provider';
import { BeamerConfig } from './types/config';

export const EthereumProviderKey: InjectionKey<ShallowRef<Readonly<EthereumProvider>>> =
  Symbol('EthereumProvider');

export const BeamerConfigKey: InjectionKey<Ref<Readonly<BeamerConfig>>> = Symbol('BeamerConfig');
