import type { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';

import StandardToken from '@/assets/StandardToken.json';
import type { EthereumProvider } from '@/services/web3-provider';
import type { UInt256 } from '@/types/uint-256';

export async function ensureTokenAllowance(
  signer: JsonRpcSigner,
  tokenAddress: string,
  allowedSpender: string,
  minimumRequiredAmount: UInt256,
): Promise<void> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi, signer);
  const signerAddress = await signer.getAddress();
  const signerTokenBalance = await tokenContract.balanceOf(signerAddress);
  const allowance: BigNumber = await tokenContract.allowance(signerAddress, allowedSpender);
  if (allowance.lt(BigNumber.from(minimumRequiredAmount.asString))) {
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
