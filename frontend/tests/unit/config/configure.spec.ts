import type { ChainMetadata, DeploymentInfo, TokenMetadata } from 'config';
import { generateAppConfig, generateTestToken } from 'config/configure';
import * as utils from 'config/utils';

import {
  generateChainMetadata,
  generateDeploymentInfo,
  generateTokenMetadata,
  getRandomEthereumAddress,
  getRandomNumber,
} from '~/utils/data_generators';

function generateDeploymentInfoForFolder(folderName?: string) {
  return generateDeploymentInfo({
    L2: {
      [getRandomNumber()]: generateMintableTokenDeploymentInfo(),
    },
    folderName,
  });
}
function generateMintableTokenDeploymentInfo() {
  return {
    MintableToken: {
      address: getRandomEthereumAddress(),
    },
  };
}

function mockUtils(options?: {
  readTokenMetadataFolder?: Array<TokenMetadata>;
  readChainMetadataFolder?: Array<ChainMetadata>;
  readDeploymentFolder?: Array<DeploymentInfo>;
}) {
  Object.defineProperties(utils, {
    readTokenMetadataFolder: {
      value: vi.fn().mockReturnValue(options?.readTokenMetadataFolder ?? []),
    },
    readChainMetadataFolder: {
      value: vi.fn().mockReturnValue(options?.readChainMetadataFolder ?? []),
    },
    readDeploymentFolder: {
      value: vi.fn().mockReturnValue(options?.readDeploymentFolder ?? []),
    },
  });
}

describe('configure', () => {
  beforeEach(() => {
    mockUtils();
  });
  describe('generateTestToken()', () => {
    it('generates the test token using the latest deployment info', () => {
      const deploymentInfoLocal = generateDeploymentInfoForFolder('ganache-local');
      const deploymentInfoTestnet = generateDeploymentInfoForFolder('some-testnet');

      mockUtils({
        readDeploymentFolder: [deploymentInfoLocal, deploymentInfoTestnet],
      });

      const TSTToken = generateTestToken();

      expect(TSTToken.addresses).toEqual({
        ...deploymentInfoLocal.getMintableTokenAddresses(),
        ...deploymentInfoTestnet.getMintableTokenAddresses(),
      });
    });
    it('ignores mainnet deployment info when reading from deployment folder', () => {
      const rootDeploymentFolder = 'testFolder';
      generateTestToken(rootDeploymentFolder);
      expect(utils.readDeploymentFolder).toHaveBeenCalledWith(rootDeploymentFolder, ['mainnet']);
    });
  });

  describe('generateAppConfig()', () => {
    it('generates app config from deployment & metadata files', () => {
      const chainMetas = [
        generateChainMetadata({
          identifier: 1337,
          tokenSymbols: ['TEST'],
        }),
      ];
      const tokenMetas = [
        generateTokenMetadata({
          symbol: 'TEST',
          addresses: {
            1337: getRandomEthereumAddress(),
          },
        }),
      ];
      const deploymentInfo = generateDeploymentInfo({
        L2: {
          1337: {
            RequestManager: {
              address: getRandomEthereumAddress(),
            },
            FillManager: {
              address: getRandomEthereumAddress(),
            },
          },
        },
      });

      const config = generateAppConfig(deploymentInfo, chainMetas, tokenMetas);

      expect(config.chains['1337']).toBeDefined();
      expect(config.chains['1337'].tokens.length).toBeGreaterThan(0);
      expect(config.chains['1337'].tokens[0].symbol).toBe('TEST');
      expect(config.chains['1337'].requestManagerAddress).toBeDefined();
      expect(config.chains['1337'].fillManagerAddress).toBeDefined();
    });
  });
});
