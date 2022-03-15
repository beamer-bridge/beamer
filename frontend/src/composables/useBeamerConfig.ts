import { onMounted, readonly, Ref, ref } from 'vue';

import { BeamerConfig } from '@/types/config';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useBeamerConfig() {
  const config: Ref<Readonly<BeamerConfig | undefined>> = ref(undefined);

  onMounted(async () => {
    try {
      const configResponse = await fetch(import.meta.env.VITE_CONFIG_URL);
      config.value = readonly((await configResponse.json()) as BeamerConfig);
    } catch (error) {
      console.error(error);
    }
  });

  return {
    config,
  };
}
