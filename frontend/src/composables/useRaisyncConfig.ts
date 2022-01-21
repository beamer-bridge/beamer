import { onMounted, readonly, Ref, ref } from 'vue';

import { RaisyncConfig } from '@/types/config';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useRaisyncConfig() {
  const config: Ref<Readonly<RaisyncConfig | undefined>> = ref(undefined);

  onMounted(async () => {
    try {
      const configResponse = await fetch(process.env.VUE_APP_CONFIG_URL);
      config.value = readonly((await configResponse.json()) as RaisyncConfig);
    } catch (error) {
      console.error(error);
    }
  });

  return {
    config,
  };
}
