import { DeploymentInfo } from 'config/deployment';
import * as utils from 'config/utils';

import { generateDeploymentInfo, getRandomEthereumAddress } from '~/utils/data_generators';

describe('DeploymentInfo', () => {
  describe('getMintableTokenAddresses()', () => {
    it('retrieves all mintable token addresses on all chains', () => {
      const contractAddress1 = getRandomEthereumAddress();
      const contractAddress2 = getRandomEthereumAddress();
      const deploymentInfo = generateDeploymentInfo({
        chains: {
          '1': {
            MintableToken: {
              address: contractAddress1,
            },
          },
          '2': {
            MintableToken: {
              address: contractAddress2,
            },
          },
        },
      });

      expect(deploymentInfo.getMintableTokenAddresses()).toEqual({
        '1': contractAddress1,
        '2': contractAddress2,
      });
    });
    it('retrieves empty object when there are no mintable token addresses', () => {
      const deploymentInfo = generateDeploymentInfo({
        chains: {
          '1': {},
          '2': {
            TestContract: {
              address: getRandomEthereumAddress(),
            },
          },
        },
      });

      expect(deploymentInfo.getMintableTokenAddresses()).toEqual({});
    });
  });

  describe('supportedChains()', () => {
    it('retrieves all chains for which there was a deployment', () => {
      const deploymentInfo = generateDeploymentInfo({
        chains: {
          '1': {},
          '2': {},
        },
      });
      expect(deploymentInfo.supportedChains).toEqual(['1', '2']);
    });
  });

  describe('formatChainDeploymentInfo()', () => {
    describe('when provided chain id is supported', () => {
      it('returns a normalized representation of the deployment for a specific chain', () => {
        const requestManagerAddress = getRandomEthereumAddress();
        const fillManagerAddress = getRandomEthereumAddress();
        const deploymentInfo = generateDeploymentInfo({
          chains: {
            '1': {
              RequestManager: {
                address: requestManagerAddress,
              },
              FillManager: {
                address: fillManagerAddress,
              },
            },
          },
        });
        expect(deploymentInfo.formatChainDeploymentInfo('1')).toEqual({
          identifier: 1,
          requestManagerAddress,
          fillManagerAddress,
        });
      });
    });
    // TODO: test other cases
  });

  describe('readFromFile()', () => {
    it("fails to read if file doesn't exist", () => {
      expect(() => DeploymentInfo.readFromFile('test.json')).toThrow();
    });
    it('instantiates an object from a local file', () => {
      const filePath = `testnet/test.json`;
      const mockDeploymentInfo = generateDeploymentInfo({
        folderName: 'testnet',
      });
      Object.defineProperty(utils, 'readFileJsonContent', {
        value: vi.fn().mockReturnValue(mockDeploymentInfo),
      });

      const deploymentInfo = DeploymentInfo.readFromFile(filePath);
      expect(Object.keys(deploymentInfo)).toEqual(Object.keys(mockDeploymentInfo));
      expect(Object.values(deploymentInfo)).toEqual(Object.values(mockDeploymentInfo));
    });
  });
});
