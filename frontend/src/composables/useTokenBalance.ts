import type { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Contract, ethers } from 'ethers';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import StandardToken from '@/assets/StandardToken.json';
import { getTokenBalance, getTokenDecimals } from '@/services/transactions/token';
import type { IEthereumProvider } from '@/services/web3-provider';

export function useTokenBalance(
  provider: Ref<IEthereumProvider | undefined>,
  signer: Ref<JsonRpcSigner | undefined>,
  tokenAddress: Ref<string | undefined>,
) {
  const error = ref<string | undefined>(undefined);
  const signerAddress = ref<string | undefined>(undefined);
  const balance = ref(BigNumber.from(0));
  const decimals = ref(BigNumber.from(0));

  const available = computed(() => !!signerAddress.value && !!tokenAddress.value);

  const formattedBalance = computed(() => {
    const cutoff = balance.value.mod(1e14);
    return ethers.utils.formatUnits(balance.value.sub(cutoff), decimals.value);
  });

  let tokenContract: Contract;

  async function updateTokenBalance(
    provider: IEthereumProvider | undefined,
    tokenAddress: string | undefined,
    signerAddress: string | undefined,
  ) {
    if (!provider || !tokenAddress || !signerAddress) {
      balance.value = BigNumber.from(0);
      return;
    }

    try {
      balance.value = await getTokenBalance(provider, tokenAddress, signerAddress);
    } catch (exception: unknown) {
      handleException(exception);
    }
  }

  function handleException(exception: unknown) {
    const errorMessage = (exception as { message?: string }).message;
    error.value = errorMessage ?? 'Unknown Failure!';
  }

  async function listenToTokenBalance() {
    error.value = undefined;

    if (!provider.value || !tokenAddress.value || !signer.value) {
      balance.value = BigNumber.from(0);
      return;
    }

    try {
      signerAddress.value = await signer.value.getAddress();
      decimals.value = await getTokenDecimals(provider.value, tokenAddress.value);
    } catch (exception: unknown) {
      handleException(exception);
    }

    await updateTokenBalance(provider.value, tokenAddress.value, signerAddress.value);

    if (tokenContract) {
      tokenContract.removeAllListeners();
    }

    tokenContract = provider.value.connectContract(
      new Contract(tokenAddress.value, StandardToken.abi),
    );

    const sendFilter = tokenContract.filters.Transfer(signerAddress.value, undefined);
    const receiveFilter = tokenContract.filters.Transfer(undefined, signerAddress.value);

    tokenContract.on(sendFilter, async () => {
      await updateTokenBalance(provider.value, tokenAddress.value, signerAddress.value);
    });

    tokenContract.on(receiveFilter, async () => {
      await updateTokenBalance(provider.value, tokenAddress.value, signerAddress.value);
    });
  }

  watch([tokenAddress, provider, signer], listenToTokenBalance, { immediate: true });

  return { available, balance, formattedBalance, error };
}
