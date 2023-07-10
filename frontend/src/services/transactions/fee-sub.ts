import { getJsonRpcProvider, getReadOnlyContract } from '@/services/transactions/utils';
import type { Chain, Token } from '@/types/data';
import type { FeeSub } from '@/types/ethers-contracts';
import { FeeSub__factory } from '@/types/ethers-contracts';
import type { TokenAmount } from '@/types/token-amount';
import { UInt256 } from '@/types/uint-256';

export async function amountCanBeSubsidized(
  chain: Chain,
  token: Token,
  tokenAmount: TokenAmount,
): Promise<boolean> {
  if (!chain.feeSubAddress) {
    return false;
  }
  const provider = getJsonRpcProvider(chain.internalRpcUrl);

  const feeSubContract = getReadOnlyContract<FeeSub>(
    chain.feeSubAddress,
    FeeSub__factory.createInterface(),
    provider,
  );
  const threshold = await feeSubContract.minimumAmounts(token.address);

  if (threshold.isZero() || tokenAmount.uint256.lt(UInt256.parse(threshold.toString()))) {
    return false;
  }

  return true;
}
