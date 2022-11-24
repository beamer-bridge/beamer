import { getAmountBeforeFees } from '@/services/transactions/request-manager';
import * as transactionUtils from '@/services/transactions/utils';
import { UInt256 } from '@/types/uint-256';
import { getRandomEthereumAddress, getRandomUrl } from '~/utils/data_generators';

vi.mock('@/services/transactions/utils');

const PARTS_IN_PERCENT = 100;
const PARTS_IN_MILLION = 1000000;

function mockGetReadOnlyContractReturnValue(options?: {
  minLpFeeWei?: UInt256;
  lpFeePartsPerMillion?: UInt256;
  protocolFeePartsPerMillion?: UInt256;
}) {
  Object.defineProperty(transactionUtils, 'getReadOnlyContract', {
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

describe('request-manager', () => {
  beforeEach(() => {
    global.console.error = vi.fn();
  });
  describe('deriveBaseAmountFromTotalTransferAmount()', () => {
    describe('when percentage lp fee is higher than the minimal lp fee for the provided token amount', () => {
      it('returns the amount before fees for the provided total amount by using percentage fees', async () => {
        const rpcUrl = getRandomUrl('rpc');
        const requestManagerAddress = getRandomEthereumAddress();
        const DECIMALS = 4;

        const minLpFee = 0.001;
        const lpFeePercent = 0.3;
        const protocolFeePercent = 0.3;

        const minLpFeeWei = UInt256.parse(minLpFee.toString(), DECIMALS);
        const lpFeePartsPerMillion = new UInt256(transformPercentToPPM(lpFeePercent));
        const protocolFeePartsPerMillion = new UInt256(transformPercentToPPM(protocolFeePercent));

        mockGetReadOnlyContractReturnValue({
          minLpFeeWei,
          lpFeePartsPerMillion,
          protocolFeePartsPerMillion,
        });

        const totalAmounts = [
          UInt256.parse('10', DECIMALS),
          UInt256.parse('100', DECIMALS),
          UInt256.parse('1000', DECIMALS),
        ];
        const expectedResult = [
          new UInt256('99403'),
          new UInt256('994035'),
          new UInt256('9940357'),
        ];
        const testCases = [
          [totalAmounts[0], expectedResult[0]],
          [totalAmounts[1], expectedResult[1]],
          [totalAmounts[2], expectedResult[2]],
        ];

        testCases.forEach(async ([amount, expectedResult]) => {
          const result = await getAmountBeforeFees(amount, rpcUrl, requestManagerAddress);
          expect(result.asString).toBe(expectedResult.asString);
        });
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

        mockGetReadOnlyContractReturnValue({ minLpFeeWei, lpFeePartsPerMillion });

        expect(getAmountBeforeFees(totalAmountWei, rpcUrl, requestManagerAddress)).rejects.toThrow(
          'Total amount is not high enough to cover the fees.',
        );
      });

      it('returns the amount before fees for the provided total amount by using protocol percentage fee & minimal lp fee in units', async () => {
        const rpcUrl = getRandomUrl('rpc');
        const requestManagerAddress = getRandomEthereumAddress();
        const DECIMALS = 4;

        const minLpFee = 1;
        const lpFeePercent = 0.003;
        const protocolFeePercent = 0.3;

        const minLpFeeWei = UInt256.parse(minLpFee.toString(), DECIMALS);
        const lpFeePartsPerMillion = new UInt256(transformPercentToPPM(lpFeePercent));
        const protocolFeePartsPerMillion = new UInt256(transformPercentToPPM(protocolFeePercent));

        mockGetReadOnlyContractReturnValue({
          minLpFeeWei,
          lpFeePartsPerMillion,
          protocolFeePartsPerMillion,
        });

        const totalAmounts = [
          UInt256.parse('10', DECIMALS),
          UInt256.parse('100', DECIMALS),
          UInt256.parse('1000', DECIMALS),
        ];
        const expectedResult = [
          new UInt256('89700'),
          new UInt256('987008'),
          new UInt256('9960089'),
        ];
        const testCases = [
          [totalAmounts[0], expectedResult[0]],
          [totalAmounts[1], expectedResult[1]],
          [totalAmounts[2], expectedResult[2]],
        ];

        testCases.forEach(async ([amount, expectedResult]) => {
          const result = await getAmountBeforeFees(amount, rpcUrl, requestManagerAddress);
          expect(result.asString).toBe(expectedResult.asString);
        });
      });
    });
  });
});
