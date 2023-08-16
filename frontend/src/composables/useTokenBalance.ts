import type { Contract } from 'ethers';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

import { getTokenBalance, listenOnTokenBalanceChange } from '@/services/transactions/token';
import type { IEthereumProvider } from '@/services/web3-provider';
import type { EthereumAddress, Token } from '@/types/data';
import type { TokenAmount } from '@/types/token-amount';

export function useTokenBalance(
  provider: Ref<IEthereumProvider | undefined>,
  accountAddress: Ref<EthereumAddress | undefined>,
  token: Ref<Token | undefined>,
) {
  const error = ref<string | undefined>(undefined);
  const balance: Ref<TokenAmount | undefined> = ref(undefined);
  const formattedBalance = computed(() => balance.value?.format());

  let tokenContract: Contract;

  function handleException(exception: unknown) {
    const errorMessage = (exception as { message?: string }).message;
    error.value = errorMessage ?? 'Unknown Failure!';
  }

  async function updateTokenBalance(
    provider: IEthereumProvider,
    token: Token,
    accountAddress: EthereumAddress,
  ) {
    try {
      balance.value = await getTokenBalance(provider, token, accountAddress);
    } catch (exception: unknown) {
      handleException(exception);
    }
  }

  function detachTokenBalanceListeners() {
    if (tokenContract) {
      tokenContract.removeAllListeners();
    }
  }

  function attachTokenBalanceListeners(
    provider: IEthereumProvider,
    token: Token,
    accountAddress: EthereumAddress,
  ) {
    try {
      tokenContract = listenOnTokenBalanceChange({
        provider: provider,
        token: token,
        addressToListen: accountAddress,
        onReduce: updateTokenBalance.bind(null, provider, token, accountAddress),
        onIncrease: updateTokenBalance.bind(null, provider, token, accountAddress),
      });
    } catch (exception: unknown) {
      handleException(exception);
    }
  }

  async function handleParamsChange() {
    error.value = undefined;
    detachTokenBalanceListeners();

    if (!provider.value || !token.value || !accountAddress.value) {
      balance.value = undefined;
      return;
    } else {
      attachTokenBalanceListeners(provider.value, token.value, accountAddress.value);
      updateTokenBalance(provider.value, token.value, accountAddress.value);
    }
  }

  watch([token, provider, accountAddress], handleParamsChange, { immediate: true });

  return { balance, formattedBalance, error };
}
