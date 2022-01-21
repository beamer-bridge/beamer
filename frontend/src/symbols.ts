import { InjectionKey, Ref, ShallowRef } from 'vue';

import { EthereumProvider } from './services/web3-provider';
import { RaisyncConfig } from './types/config';

export const EthereumProviderKey: InjectionKey<ShallowRef<Readonly<EthereumProvider>>> =
  Symbol('EthereumProvider');

export const RaisyncConfigKey: InjectionKey<Ref<Readonly<RaisyncConfig>>> =
  Symbol('RaisyncConfig');
