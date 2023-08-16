import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';

import ConnectionError from '@/components/wallet/ConnectionError.vue';
import type { BeamerConfig } from '@/types/config';
import {
  generateBeamerConfig,
  generateChainWithTokens,
  getRandomNumber,
} from '~/utils/data_generators';
import { MockedEthereumWallet } from '~/utils/mocks/ethereum-provider';

function createWrapper(options?: { connectedChainId?: number; config?: BeamerConfig }) {
  return mount(ConnectionError, {
    shallow: true,
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            ethereumWallet: {
              provider: new MockedEthereumWallet({
                chainId: options?.connectedChainId ?? getRandomNumber(),
              }),
            },
            configuration: options?.config ?? generateBeamerConfig(),
          },
        }),
      ],
    },
  });
}

describe('ConnectionError.vue', () => {
  it('shows an error message when connected chain is not supported', () => {
    const wrapper = createWrapper({
      connectedChainId: 99,
      config: generateBeamerConfig({
        chains: { 101: generateChainWithTokens({ identifier: 101 }) },
      }),
    });

    expect(wrapper.text()).toEqual('Connected chain is not supported');
  });
  it('shows no error message when connected chain is supported', () => {
    const wrapper = createWrapper({
      connectedChainId: 50,
      config: generateBeamerConfig({
        chains: { 50: generateChainWithTokens({ identifier: 50 }) },
      }),
    });

    expect(wrapper.text()).toEqual('');
  });
});
