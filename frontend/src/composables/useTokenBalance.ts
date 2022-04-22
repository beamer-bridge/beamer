import type { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Contract, ethers } from 'ethers';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import StandardToken from '@/assets/StandardToken.json';
import { getTokenBalance, getTokenDecimals } from '@/services/transactions/token';
import type { EthereumProvider } from '@/services/web3-provider';

export function useTokenBalance(
  provider: Ref<EthereumProvider | undefined>,
  signer: Ref<JsonRpcSigner | undefined>,
  tokenAddress: Ref<string | undefined>,
) {
  const error = ref<string | undefined>(undefined);
  const signerAddress = ref<string | undefined>(undefined);
  const balance = ref(BigNumber.from(0));
  const decimals = ref(BigNumber.from(0));

  const show = computed(() => !!signerAddress.value && !!tokenAddress.value);
  const formattedBalance = computed(() => {
    const cutoff = balance.value.mod(1e14);
    return ethers.utils.formatUnits(balance.value.sub(cutoff), decimals.value);
  });

  let tokenContract: Contract;

  async function listenToTokenBalance() {
    error.value = undefined;

    if (!provider.value || !tokenAddress.value || !signer.value) {
      balance.value = BigNumber.from(0);
      return;
    }

    try {
      signerAddress.value = await signer.value.getAddress();
      decimals.value = await getTokenDecimals(provider.value, tokenAddress.value);
      balance.value = await getTokenBalance(
        provider.value,
        tokenAddress.value,
        signerAddress.value,
      );
    } catch (exception) {
      error.value = exception.message ?? exception;
    }

    if (tokenContract) {
      tokenContract.removeAllListeners();
    }

    tokenContract = provider.value.connectContract(
      new Contract(tokenAddress.value, StandardToken.abi),
    );

    const sendFilter = tokenContract.filters.Transfer(signerAddress.value, undefined);
    const receiveFilter = tokenContract.filters.Transfer(undefined, signerAddress.value);

    tokenContract.on(
      sendFilter,
      (_from: string, _to: string, amount: BigNumber) =>
        (balance.value = balance.value.sub(amount)),
    );

    tokenContract.on(
      receiveFilter,
      (_from: string, _to: string, amount: BigNumber) =>
        (balance.value = balance.value.add(amount)),
    );
  }

  watch([tokenAddress, provider, signer], listenToTokenBalance, { immediate: true });

  return { show, balance, formattedBalance, error };
}
