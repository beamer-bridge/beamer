import { BigNumber, Contract, ethers } from 'ethers';
import { storeToRefs } from 'pinia';
import { computed, Ref, ref, watch } from 'vue';

import StandardToken from '@/assets/StandardToken.json';
import { getTokenBalance, getTokenDecimals } from '@/services/transactions/token';
import { useEthereumProvider } from '@/stores/ethereum-provider';
import { SelectorOption } from '@/types/form';

export default function useTokenBalance(selectedToken: Ref<SelectorOption | undefined>) {
  const ethereumProvider = useEthereumProvider();
  const showTokenBalance = computed(() => Boolean(ethereumProvider.signer && selectedToken.value));
  const tokenBalance = ref(BigNumber.from(0));
  const tokenDecimals = ref(BigNumber.from(0));
  let tokenContract: Contract;

  async function listenToTokenBalance() {
    if (!selectedToken.value || !ethereumProvider.provider || !ethereumProvider.signerAddress) {
      return;
    }
    if (tokenContract) {
      tokenContract.removeAllListeners();
    }
    tokenContract = ethereumProvider.provider.connectContract(
      new Contract(selectedToken.value.value, StandardToken.abi),
    );

    tokenBalance.value =
      (await getTokenBalance(selectedToken.value.value, ethereumProvider.signerAddress)) ??
      BigNumber.from(0);
    const sendFilter = tokenContract.filters.Transfer(ethereumProvider.signerAddress, undefined);
    const receiveFilter = tokenContract.filters.Transfer(
      undefined,
      ethereumProvider.signerAddress,
    );
    tokenContract.on(
      sendFilter,
      (from: string, to: string, amount: BigNumber) =>
        (tokenBalance.value = tokenBalance.value.sub(amount)),
    );
    tokenContract.on(
      receiveFilter,
      (from: string, to: string, amount: BigNumber) =>
        (tokenBalance.value = tokenBalance.value.add(amount)),
    );
  }

  watch(selectedToken, async () => {
    if (!selectedToken.value) {
      return;
    }
    tokenDecimals.value = (await getTokenDecimals(selectedToken.value.value)) ?? BigNumber.from(0);
    listenToTokenBalance();
  });

  const { signerAddress } = storeToRefs(ethereumProvider);
  watch(signerAddress, listenToTokenBalance);

  const formattedTokenBalance = computed(() => {
    const cutoff = tokenBalance.value.mod(1e14);
    return ethers.utils.formatUnits(tokenBalance.value.sub(cutoff), tokenDecimals.value);
  });

  return { showTokenBalance, formattedTokenBalance };
}
