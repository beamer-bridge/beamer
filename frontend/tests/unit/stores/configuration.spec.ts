import { createPinia, setActivePinia } from 'pinia';

import { useConfiguration } from '@/stores/configuration';
import { generateChainConfiguration } from '~/utils/data_generators';

describe('configuration store', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('setChainConfiguration()', () => {
    it('can add a new chain configuration', async () => {
      const configuration = useConfiguration();
      const chainConfiguration = generateChainConfiguration();

      expect(configuration.chains['5']).toBeUndefined();

      configuration.setChainConfiguration('5', chainConfiguration);

      expect(configuration.chains['5']).toMatchObject(chainConfiguration);
    });

    it('can update existing chain configuration', async () => {
      const configuration = useConfiguration();
      const oldChainConfiguration = generateChainConfiguration({ name: 'old-name' });
      const newChainConfiguration = { ...oldChainConfiguration, name: 'new-name' };
      configuration.$state = { chains: { ['5']: oldChainConfiguration } };

      expect(configuration.chains['5']).toMatchObject(oldChainConfiguration);

      configuration.setChainConfiguration('5', newChainConfiguration);

      expect(configuration.chains['5']).toMatchObject(newChainConfiguration);
    });
  });
});
