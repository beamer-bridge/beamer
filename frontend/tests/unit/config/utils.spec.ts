import { ChainMetadata } from 'config/chains/chain';
import { DeploymentInfo } from 'config/deployment';
import { TokenMetadata } from 'config/tokens/token';
import {
  getEnvironmentForFolder,
  readChainMetadataFolder,
  readDeploymentFolder,
  readFileJsonContent,
  readTokenMetadataFolder,
  scanMetadataFolder,
  writeToFile,
} from 'config/utils';
import fs from 'fs';

import {
  generateChainMetadata,
  generateDeploymentInfo,
  generateTokenMetadata,
  getRandomString,
} from '~/utils/data_generators';

vi.mock('fs');

describe('utils', () => {
  describe('readFileJsonContent()', () => {
    it("reads and parses file's content to a JSON object", () => {
      const fileContent = { key: 'value' };
      fs.readFileSync = vi.fn().mockReturnValue(JSON.stringify(fileContent));
      const result = readFileJsonContent('test.json');
      expect(result).toEqual(fileContent);
    });
    it('throws when file is not found', () => {
      expect(() => readFileJsonContent('test.json')).toThrow();
    });
    it('throws when file content is not valid JSON', () => {
      fs.readFileSync = vi.fn().mockReturnValue('test');
      expect(() => readFileJsonContent('test.json')).toThrow();
    });
  });

  describe('writeToFile()', () => {
    it('allows writing stringified content to a file', () => {
      fs.writeFileSync = vi.fn();
      writeToFile('test.json', 'test content');

      expect(fs.writeFileSync).toHaveBeenCalledWith('test.json', 'test content');
    });
  });

  describe('scanMetadataFolder()', () => {
    it('scans folder for metadata .json files', () => {
      const dirFiles = ['1.json', '2.json', 'test.txt', 'test.ts'];
      fs.readdirSync = vi.fn().mockReturnValue(dirFiles);
      expect(scanMetadataFolder('test.json')).toEqual(['1.json', '2.json']);
    });

    it('allows scanning while ignoring certain file names', () => {
      const dirFiles = ['1.json', '2.json', '3.json'];
      const ignoredFiles = ['3.json'];
      fs.readdirSync = vi.fn().mockReturnValue(dirFiles);
      expect(scanMetadataFolder('test.json', ignoredFiles)).toEqual(['1.json', '2.json']);
    });
  });

  describe('readTokenMetadataFolder()', () => {
    it('reads & parses files from metadata folder to token metadata instances', () => {
      const dirFiles = ['1.json', '2.json'];
      const tokenMetadata = generateTokenMetadata();

      TokenMetadata.readFromFile = vi.fn().mockReturnValue(tokenMetadata);
      fs.readdirSync = vi.fn().mockReturnValue(dirFiles);

      const result = readTokenMetadataFolder('test');
      expect(result).toEqual([tokenMetadata, tokenMetadata]);
    });
  });
  describe('readChainMetadataFolder()', () => {
    it('reads & parses files from metadata folder to chain metadata instances', () => {
      const dirFiles = ['1.json', '2.json'];
      const chainMetadata = generateChainMetadata();

      ChainMetadata.readFromFile = vi.fn().mockReturnValue(chainMetadata);
      fs.readdirSync = vi.fn().mockReturnValue(dirFiles);

      const result = readChainMetadataFolder('test');
      expect(result).toEqual([chainMetadata, chainMetadata]);
    });
  });
  describe('readDeploymentFolder()', () => {
    beforeEach(() => {
      fs.existsSync = vi.fn().mockReturnValue(true);
    });

    it('reads & parses files from deployment folders to deployment info instances', () => {
      const dirFiles = ['mainnet', 'goerli'];
      const deploymentInfo = generateDeploymentInfo();

      DeploymentInfo.readFromFile = vi.fn().mockReturnValue(deploymentInfo);
      fs.readdirSync = vi.fn().mockReturnValue(dirFiles);

      const result = readDeploymentFolder('deployments');
      expect(result).toEqual([deploymentInfo, deploymentInfo]);
    });
    it('allows reading while ignoring certain deployment folders', () => {
      const dirFiles = ['mainnet', 'goerli'];
      const ignoreDirectories = ['mainnet'];
      const deploymentInfo = generateDeploymentInfo();

      DeploymentInfo.readFromFile = vi.fn().mockReturnValue(deploymentInfo);
      fs.readdirSync = vi.fn().mockReturnValue(dirFiles);

      const result = readDeploymentFolder('deployments', ignoreDirectories);
      expect(result).toEqual([deploymentInfo]);
    });
  });

  describe('getEnvironmentForFolder()', () => {
    it('returns production environment when folder name is "mainnet"', () => {
      expect(getEnvironmentForFolder('mainnet')).toBe('production');
    });
    it('returns development environment when folder name is "ganache-local"', () => {
      expect(getEnvironmentForFolder('ganache-local')).toBe('development');
    });
    it('returns "staging" when folder name is any other network name', () => {
      expect(getEnvironmentForFolder(getRandomString())).toBe('staging');
    });
  });
});
