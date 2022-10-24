import { getAmountBeforeFees } from '@/services/transactions/request-manager';
import * as transactionUtils from '@/services/transactions/utils';
import { UInt256 } from '@/types/uint-256';
import { getRandomEthereumAddress, getRandomUrl } from '~/utils/data_generators';

vi.mock('@/services/transactions/utils');

const PARTS_IN_PERCENT = 100;
const PARTS_IN_MILLION = 1000000;

function mockGetContractReturnValue(options?: {
  minLpFeeWei?: UInt256;
  lpFeePartsPerMillion?: UInt256;
  protocolFeePartsPerMillion?: UInt256;
}) {
  Object.defineProperty(transactionUtils, 'getContract', {
    value: vi.fn().mockReturnValue({
      minLpFee: vi.fn().mockReturnValue(options?.minLpFeeWei?.asString ?? '0'),
      lpFeePPM: vi.fn().mockReturnValue(options?.lpFeePartsPerMillion?.asString ?? '0'),
      protocolFeePPM: vi
        .fn()
        .mockReturnValue(options?.protocolFeePartsPerMillion?.asString ?? '0'),
    }),
  });
  return;
}

function transformPercentToPPM(percent: number): string {
  return (percent * (PARTS_IN_MILLION / PARTS_IN_PERCENT)).toString();
}
/**
 * Be careful when using this substitute function, only works for WEI values below 9007199254740991. (JS.MAX_SAFE_INTEGER)
 * This is a basic substitute of `ethersjs.utils.formatUnits` function.
 * Switching to `formatUnits` will break the tests and will introduce a dependency in the test suite.
 */
function decimalNumberToWei(number: number, decimals: number): string {
  const weiNumber = number * Math.pow(10, decimals);
  return Math.trunc(weiNumber).toString();
}

describe('request-manager', () => {
  beforeEach(() => {
    global.console.error = vi.fn();
  });
  describe('deriveBaseAmountFromTotalTransferAmount()', () => {
    describe('when percentage lp fee is higher than the minimal lp fee for the provided token amount', () => {
      it('derives the base amount (amount before fees) from the provided total amount by using percentage fees', async () => {
        const rpcUrl = getRandomUrl('rpc');
        const requestManagerAddress = getRandomEthereumAddress();
        const DECIMALS = 4;

        const totalAmountDecimal = 1000;
        const minLpFee = 1;
        const lpFeePercent = 0.3;
        const protocolFeePercent = 0.3;

        const totalAmountWei = UInt256.parse(totalAmountDecimal.toString(), DECIMALS);
        const minLpFeeWei = UInt256.parse(minLpFee.toString(), DECIMALS);
        const lpFeePartsPerMillion = new UInt256(transformPercentToPPM(lpFeePercent));
        const protocolFeePartsPerMillion = new UInt256(transformPercentToPPM(protocolFeePercent));

        mockGetContractReturnValue({
          minLpFeeWei,
          lpFeePartsPerMillion,
          protocolFeePartsPerMillion,
        });

        const baseAmount = await getAmountBeforeFees(
          totalAmountWei,
          rpcUrl,
          requestManagerAddress,
        );

        const decimalResult =
          (totalAmountDecimal * PARTS_IN_PERCENT) /
          (PARTS_IN_PERCENT + lpFeePercent + protocolFeePercent);

        expect(baseAmount.asString).toBe(decimalNumberToWei(decimalResult, DECIMALS));
      });
    });
    describe('when percentage lp fee is lower than the minimal lp fee for the provided token amount', () => {
      it('throws an exception when the base amount goes in the negative number range', async () => {
        const rpcUrl = getRandomUrl('rpc');
        const requestManagerAddress = getRandomEthereumAddress();
        const DECIMALS = 0;

        const totalAmountDecimal = 1;
        const minLpFee = 2;
        const lpFeePercent = 0.3;

        const totalAmountWei = UInt256.parse(totalAmountDecimal.toString(), DECIMALS);
        const minLpFeeWei = UInt256.parse(minLpFee.toString(), DECIMALS);
        const lpFeePartsPerMillion = new UInt256(transformPercentToPPM(lpFeePercent));

        mockGetContractReturnValue({ minLpFeeWei, lpFeePartsPerMillion });

        expect(getAmountBeforeFees(totalAmountWei, rpcUrl, requestManagerAddress)).rejects.toThrow(
          'Total amount is not high enough to cover the fees.',
        );
      });

      it('derives the base amount (amount before fees) from the provided total amount by using protocol percentage fee & minimal lp fee in units', async () => {
        const rpcUrl = getRandomUrl('rpc');
        const requestManagerAddress = getRandomEthereumAddress();
        const DECIMALS = 4;

        const totalAmountDecimal = 1000;
        const minLpFee = 10;
        const lpFeePercent = 0.3;
        const protocolFeePercent = 0.3;

        const totalAmountWei = UInt256.parse(totalAmountDecimal.toString(), DECIMALS);
        const minLpFeeWei = UInt256.parse(minLpFee.toString(), DECIMALS);
        const lpFeePartsPerMillion = new UInt256(transformPercentToPPM(lpFeePercent));
        const protocolFeePartsPerMillion = new UInt256(transformPercentToPPM(protocolFeePercent));

        mockGetContractReturnValue({
          minLpFeeWei,
          lpFeePartsPerMillion,
          protocolFeePartsPerMillion,
        });

        const baseAmount = await getAmountBeforeFees(
          totalAmountWei,
          rpcUrl,
          requestManagerAddress,
        );

        const decimalResult =
          (totalAmountDecimal * PARTS_IN_PERCENT) / (PARTS_IN_PERCENT + protocolFeePercent) -
          minLpFee;

        expect(baseAmount.asString).toBe(decimalNumberToWei(decimalResult, DECIMALS));
      });
    });
  });
});
