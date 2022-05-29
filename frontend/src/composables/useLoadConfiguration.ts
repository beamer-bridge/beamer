import { onMounted, ref } from 'vue';

import type { BeamerConfig, ChainConfig } from '@/types/config';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useLoadConfiguration(
  setChainConfiguration: (id: string, configuration: ChainConfig) => void,
) {
  const configurationLoaded = ref(false);

  onMounted(async () => {
    const configurationFile = await fetchConfigurationFile();

    for (const [chainId, chainConfiguration] of Object.entries(configurationFile.chains)) {
      setChainConfiguration(chainId, chainConfiguration);
    }

    configurationLoaded.value = true;
  });

  return { configurationLoaded };
}

const fetchConfigurationFile = async (): Promise<BeamerConfig> => {
  try {
    const response = await fetch(import.meta.env.VITE_CONFIG_URL);
    return response.json();
  } catch (error) {
    console.error(error);
    return { chains: {} };
  }
};
