import type { JsonRpcSigner } from '@ethersproject/providers';
import type { BigNumber } from 'ethers';
import { Contract } from 'ethers';

import StandardToken from '@/assets/StandardToken.json';
import type { EthereumProvider } from '@/services/web3-provider';

export async function ensureTokenAllowance(
  signer: JsonRpcSigner,
  tokenAddress: string,
  allowedSpender: string,
  amount: BigNumber,
): Promise<void> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi, signer);
  const signerAddress = await signer.getAddress();
  const signerTokenBalance = await tokenContract.balanceOf(signerAddress);
  const allowance: BigNumber = await tokenContract.allowance(signerAddress, allowedSpender);
  if (allowance.lt(amount)) {
    const transaction = await tokenContract.approve(allowedSpender, signerTokenBalance);
    await transaction.wait();
  }
}

export async function getTokenDecimals(
  provider: EthereumProvider,
  tokenAddress: string,
): Promise<BigNumber> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi);
  const connectedContract = provider.connectContract(tokenContract);
  return await connectedContract.decimals();
}

export async function getTokenBalance(
  provider: EthereumProvider,
  tokenAddress: string,
  accountAddress: string,
): Promise<BigNumber> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi);
  const connectedContract = provider.connectContract(tokenContract);
  return await connectedContract.balanceOf(accountAddress);
}
