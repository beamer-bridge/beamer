import { getJsonRpcProvider, getReadOnlyContract } from '@/services/transactions/utils';
import type { Chain, Token } from '@/types/data';
import type { FeeSub } from '@/types/ethers-contracts';
import { FeeSub__factory } from '@/types/ethers-contracts';
import type { TokenAmount } from '@/types/token-amount';

export async function amountCanBeSubsidized(
  sourceChain: Chain,
  targetChain: Chain,
  token: Token,
  tokenAmount: TokenAmount,
): Promise<boolean> {
  if (!sourceChain.feeSubAddress) {
    return false;
  }
  const provider = getJsonRpcProvider(sourceChain.internalRpcUrl);

  const feeSubContract = getReadOnlyContract<FeeSub>(
    sourceChain.feeSubAddress,
    FeeSub__factory.createInterface(),
    provider,
  );

  const canBeSubsidized = await feeSubContract.tokenAmountCanBeSubsidized(
    targetChain.identifier,
    token.address,
    tokenAmount.uint256.asBigNumber,
  );

  return canBeSubsidized;
}
