import type { JsonRpcSigner } from '@ethersproject/providers';
import type { Ref } from 'vue';
import { computed, reactive } from 'vue';

import { useAsynchronousTask } from '@/composables/useAsynchronousTask';
import { requestFaucet } from '@/services/transactions/faucet';

export function useFaucet(
  signer: Ref<JsonRpcSigner | undefined>,
  chainId: Ref<number | undefined>,
) {
  const faucetUsedForChain: Record<string, boolean> = reactive({});
  const faucetUsed = computed(() =>
    chainId.value ? faucetUsedForChain[chainId.value as unknown as number] : false,
  );
  const available = computed(() => !faucetUsed.value && signer.value && chainId.value);

  const executeFaucetRequest = async () => {
    if (!signer.value || !chainId.value) {
      throw new Error('Signer or chain id missing!');
    }
    const signerAddress = await signer.value.getAddress();
    const isSuccessfulFaucetRequest = await requestFaucet(chainId.value, signerAddress);
    if (isSuccessfulFaucetRequest) {
      faucetUsedForChain[chainId.value] = true;
    }
  };

  const { active, error, run } = useAsynchronousTask(executeFaucetRequest);

  return { available, active, error, run };
}
