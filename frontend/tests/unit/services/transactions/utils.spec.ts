import * as providers from '@ethersproject/providers';
import * as ethers from 'ethers';

import { getContract } from '@/services/transactions/utils';
import { getRandomEthereumAddress, getRandomNumber, getRandomUrl } from '~/utils/data_generators';

vi.mock('@ethersproject/providers');
vi.mock('ethers');

describe('utils', () => {
  beforeEach(() => {
    Object.defineProperty(providers, 'JsonRpcProvider', {
      value: vi
        .fn()
        .mockReturnValue({ getBlockNumber: vi.fn().mockReturnValue(getRandomNumber()) }),
    });
  });

  describe('getContract()', () => {
    it('returns a contract instance', () => {
      const rpcUrl = getRandomUrl('rpc');
      const contractAddress = getRandomEthereumAddress();
      const ABI = '';

      expect(getContract(rpcUrl, contractAddress, ABI)).toBeInstanceOf(ethers.Contract);
    });
  });
});
