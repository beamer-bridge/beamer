import { DeploymentInfo } from 'config/deployment';
import * as utils from 'config/utils';
import fs from 'fs';

import {
  generateChainDeploymentInfo,
  generateDeploymentInfo,
  getRandomEthereumAddress,
} from '~/utils/data_generators';

vi.mock('fs');

describe('DeploymentInfo', () => {
  describe('getMintableTokenAddresses()', () => {
    it('retrieves all mintable token addresses on all chains', () => {
      const contractAddress1 = getRandomEthereumAddress();
      const contractAddress2 = getRandomEthereumAddress();
      const deploymentInfo = generateDeploymentInfo({
        chains: {
          '1': {
            chain: generateChainDeploymentInfo({
              MintableToken: {
                address: contractAddress1,
              },
            }),
          },
          '2': {
            chain: generateChainDeploymentInfo({
              MintableToken: {
                address: contractAddress2,
              },
            }),
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
          '1': { chain: generateChainDeploymentInfo({ MintableToken: undefined }) },
        },
      });

      expect(deploymentInfo.getMintableTokenAddresses()).toEqual({});
    });
  });

  describe('supportedChains()', () => {
    it('retrieves all chains for which there was a deployment', () => {
      const deploymentInfo = generateDeploymentInfo({
        chains: {
          '1': { chain: generateChainDeploymentInfo() },
          '2': { chain: generateChainDeploymentInfo() },
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
              chain: {
                RequestManager: {
                  address: requestManagerAddress,
                },
                FillManager: {
                  address: fillManagerAddress,
                },
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

  describe('readFromDirectory()', () => {
    beforeEach(() => {
      fs.readdirSync = vi.fn().mockReturnValue([]);
    });

    it('throws an exception if the folder path is invalid', () => {
      fs.readdirSync = vi.fn().mockImplementation(() => {
        throw new Error('Folder does not exist');
      });
      expect(() => DeploymentInfo.readFromDirectory('testnet/')).toThrow();
    });

    it('instantiates an object from a local file', () => {
      const folderPath = 'testnet';
      const fileNames = ['1-test.deployment.json'];
      fs.readdirSync = vi.fn().mockReturnValue(fileNames);
      const deploymentInfoFile = {
        chain: generateChainDeploymentInfo(),
      };
      const mockDeploymentInfo = generateDeploymentInfo({
        chains: { '1': deploymentInfoFile },
        folderName: folderPath,
      });
      Object.defineProperty(utils, 'readFileJsonContent', {
        value: vi.fn().mockReturnValue(deploymentInfoFile),
      });

      const deploymentInfo = DeploymentInfo.readFromDirectory(folderPath);

      expect(Object.keys(deploymentInfo)).toEqual(Object.keys(mockDeploymentInfo));
      expect(Object.values(deploymentInfo)).toEqual(Object.values(mockDeploymentInfo));
    });
  });
});
