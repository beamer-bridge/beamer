import type { Ref } from 'vue';
import { computed, reactive } from 'vue';

import { useAsynchronousTask } from '@/composables/useAsynchronousTask';
import { requestFaucet } from '@/services/transactions/faucet';
import type { EthereumAddress } from '@/types/data';

export function useFaucet(
  ethereumAddress: Ref<EthereumAddress | undefined>,
  chainId: Ref<number | undefined>,
) {
  const enabled = computed(() => import.meta.env.VITE_FAUCET_ENABLED === 'true');
  const faucetUsedForChain: Record<string, boolean> = reactive({});
  const faucetUsed = computed(() =>
    chainId.value ? faucetUsedForChain[chainId.value as unknown as number] : false,
  );
  const available = computed(
    () => !faucetUsed.value && !!ethereumAddress.value && !!chainId.value,
  );

  const executeFaucetRequest = async () => {
    if (!enabled.value) {
      throw new Error('Faucet is not enabled!');
    }

    if (faucetUsed.value) {
      throw new Error('Maximum allowed faucet requests exceeded!');
    }

    if (!ethereumAddress.value || !chainId.value) {
      throw new Error('Address or chain id missing!');
    }

    const isSuccessfulFaucetRequest = await requestFaucet(chainId.value, ethereumAddress.value);
    if (isSuccessfulFaucetRequest) {
      faucetUsedForChain[chainId.value] = true;
    }
  };

  const { active, error, run } = useAsynchronousTask(executeFaucetRequest);

  return { enabled, available, active, error, run };
}
