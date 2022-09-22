import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';

import ConnectionError from '@/components/wallet/ConnectionError.vue';
import { MockedEthereumProvider } from '~/utils/mocks/ethereum-provider';

describe('ConnectionError.vue', () => {
  it('provides an error message when connected chain is not supported', () => {
    const wrapper = mount(ConnectionError, {
      plugins: [
        createTestingPinia({
          initialState: {
            ethereumProvider: {
              provider: new MockedEthereumProvider({ chainId: 5 }),
            },
            configuration: {
              chains: { 6: {} },
            },
          },
        }),
      ],
      slots: {
        default: `<template v-slot="params">
            <span>{{params.message}}</span>
        </template>`,
      },
    });

    expect(wrapper.text()).toEqual('Connected chain is not supported');
  });
});
