import { BigNumber, Contract, ethers } from 'ethers';
import { computed, Ref, ref, ShallowRef, watch } from 'vue';

import StandardToken from '@/assets/StandardToken.json';
import { getTokenBalance, getTokenDecimals } from '@/services/transactions/token';
import { EthereumProvider } from '@/services/web3-provider';
import { SelectorOption } from '@/types/form';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function useTokenBalance(
  ethereumProvider: ShallowRef<Readonly<EthereumProvider>>,
  selectedToken: Ref<SelectorOption | undefined>,
) {
  const showTokenBalance = computed(() =>
    Boolean(ethereumProvider.value.signer.value && selectedToken.value),
  );
  const tokenBalance = ref(BigNumber.from(0));
  const tokenDecimals = ref(BigNumber.from(0));
  let tokenContract: Contract;

  async function listenToTokenBalance() {
    if (!selectedToken.value || !ethereumProvider.value.signerAddress.value) {
      return;
    }
    if (tokenContract) {
      tokenContract.removeAllListeners();
    }
    tokenContract = ethereumProvider.value.connectContract(
      new Contract(selectedToken.value.value, StandardToken.abi),
    );

    tokenBalance.value = await getTokenBalance(
      ethereumProvider.value,
      selectedToken.value.value,
      ethereumProvider.value.signerAddress.value,
    );
    const sendFilter = tokenContract.filters.Transfer(
      ethereumProvider.value.signerAddress.value,
      undefined,
    );
    const receiveFilter = tokenContract.filters.Transfer(
      undefined,
      ethereumProvider.value.signerAddress.value,
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
    tokenDecimals.value = await getTokenDecimals(
      ethereumProvider.value,
      selectedToken.value.value,
    );
    listenToTokenBalance();
  });
  watch(ethereumProvider.value.signerAddress, listenToTokenBalance);

  const formattedTokenBalance = computed(() => {
    const cutoff = tokenBalance.value.mod(1e14);
    return ethers.utils.formatUnits(tokenBalance.value.sub(cutoff), tokenDecimals.value);
  });

  return { showTokenBalance, formattedTokenBalance };
}
