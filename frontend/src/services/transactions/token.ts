import { JsonRpcSigner } from '@ethersproject/providers';
import { BigNumber, Contract } from 'ethers';
import { DeepReadonly } from 'vue';

import StandardToken from '@/assets/StandardToken.json';

export async function ensureTokenAllowance(
  signer: DeepReadonly<JsonRpcSigner>,
  tokenAddress: string,
  amount: BigNumber,
): Promise<void> {
  const tokenContract = new Contract(tokenAddress, StandardToken.abi, signer);
  const signerAddress = await signer.getAddress();
  const requestManagerAddress = process.env.VUE_APP_REQUEST_MANAGER_ADDRESS;
  const allowance: BigNumber = await tokenContract.allowance(signerAddress, requestManagerAddress);
  if (allowance.lt(amount)) {
    const transaction = await tokenContract.approve(requestManagerAddress, amount);
    await transaction.wait();
  }
}
