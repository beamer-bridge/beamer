import type { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import StandardToken from '@/assets/StandardToken.json';
import { getTokenBalance, getTokenDecimals } from '@/services/transactions/token';
import type { IEthereumProvider } from '@/services/web3-provider';
import type { Token } from '@/types/data';
import type { TokenAmount } from '@/types/token-amount';

export function useTokenBalance(
  provider: Ref<IEthereumProvider | undefined>,
  signer: Ref<JsonRpcSigner | undefined>,
  token: Ref<Token | undefined>,
) {
  const error = ref<string | undefined>(undefined);
  const signerAddress = ref<string | undefined>(undefined);
  const balance: Ref<TokenAmount | undefined> = ref(undefined);
  const decimals = ref(BigNumber.from(0));

  const available = computed(() => !!signerAddress.value && !!token.value);
  const formattedBalance = computed(() => balance.value?.format());

  let tokenContract: Contract;

  async function updateTokenBalance(
    provider: IEthereumProvider | undefined,
    token: Token | undefined,
    signerAddress: string | undefined,
  ) {
    if (!provider || !token || !signerAddress) {
      balance.value = undefined;
      return;
    }

    try {
      balance.value = await getTokenBalance(provider, token, signerAddress);
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

    if (!provider.value || !token.value || !signer.value) {
      balance.value = undefined;
      return;
    }

    try {
      signerAddress.value = await signer.value.getAddress();
      decimals.value = await getTokenDecimals(provider.value, token.value.address);
    } catch (exception: unknown) {
      handleException(exception);
    }

    await updateTokenBalance(provider.value, token.value, signerAddress.value);

    if (tokenContract) {
      tokenContract.removeAllListeners();
    }

    tokenContract = provider.value.connectContract(
      new Contract(token.value.address, StandardToken.abi),
    );

    const sendFilter = tokenContract.filters.Transfer(signerAddress.value, undefined);
    const receiveFilter = tokenContract.filters.Transfer(undefined, signerAddress.value);

    tokenContract.on(sendFilter, async () => {
      await updateTokenBalance(provider.value, token.value, signerAddress.value);
    });

    tokenContract.on(receiveFilter, async () => {
      await updateTokenBalance(provider.value, token.value, signerAddress.value);
    });
  }

  watch([token, provider, signer], listenToTokenBalance, { immediate: true });

  return { available, balance, formattedBalance, error };
}
