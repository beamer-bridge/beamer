import { ref } from 'vue';

import { useAsynchronousTask } from '@/composables/useAsynchronousTask';
import type { BeamerConfig } from '@/types/config';

export default function useLoadConfiguration(
  setConfiguration: (configuration: BeamerConfig) => void,
) {
  const configurationLoaded = ref(false);

  const { run: loadConfiguration, error: configurationError } = useAsynchronousTask(async () => {
    const response = await fetch(import.meta.env.VITE_CONFIG_URL);
    const config = (await response.json()) as BeamerConfig;
    setConfiguration(config);
    configurationLoaded.value = true;
  });

  return { loadConfiguration, configurationLoaded, configurationError };
}
