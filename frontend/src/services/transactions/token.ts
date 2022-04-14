import { BigNumber, Contract } from 'ethers';

import StandardToken from '@/assets/StandardToken.json';
import { useEthereumProvider } from '@/stores/ethereum-provider';

export async function ensureTokenAllowance(
  tokenAddress: string,
  allowedSpender: string,
  amount: BigNumber,
): Promise<void> {
  const ethereumProvider = useEthereumProvider();
  const tokenContract = new Contract(tokenAddress, StandardToken.abi, ethereumProvider.signer);
  const signerTokenBalance = await tokenContract.balanceOf(ethereumProvider.signerAddress);
  const allowance: BigNumber = await tokenContract.allowance(
    ethereumProvider.signerAddress,
    allowedSpender,
  );
  if (allowance.lt(amount)) {
    const transaction = await tokenContract.approve(allowedSpender, signerTokenBalance);
    await transaction.wait();
  }
}

/**
 * @returns number of decimals of token, undefined if not connected
 */
export async function getTokenDecimals(tokenAddress: string): Promise<BigNumber | undefined> {
  const ethereumProvider = useEthereumProvider();
  const tokenContract = new Contract(tokenAddress, StandardToken.abi);
  const connectedContract = ethereumProvider.provider?.connectContract(tokenContract);
  return await connectedContract?.decimals();
}

/**
 * @returns balance of account in Wei, undefined if not connected
 */
export async function getTokenBalance(
  tokenAddress: string,
  accountAddress: string,
): Promise<BigNumber | undefined> {
  const ethereumProvider = useEthereumProvider();
  const tokenContract = new Contract(tokenAddress, StandardToken.abi);
  const connectedContract = ethereumProvider.provider?.connectContract(tokenContract);
  return await connectedContract?.balanceOf(accountAddress);
}
