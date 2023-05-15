import fs from 'fs';
import path from 'path';

import { ChainMetadata } from './chains/chain';
import { DeploymentInfo } from './deployment';
import { TokenMetadata } from './tokens/token';
import type { Environment } from './types';

export const readFileJsonContent = (filePath: string): Record<string, unknown> => {
  const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
  return JSON.parse(fileContent);
};

export const writeToFile = (filePath: string, content: string): void => {
  fs.writeFileSync(filePath, content);
};

export const scanMetadataFolder = (folderPath: string, ignoreFiles: string[] = []): string[] => {
  return fs
    .readdirSync(folderPath)
    .filter((fileName) => !ignoreFiles.includes(fileName))
    .filter((fileName) => fileName.endsWith('.json'));
};

export const readTokenMetadataFolder = (
  folderPath: string,
  ignoreFiles: string[] = [],
): TokenMetadata[] => {
  return scanMetadataFolder(folderPath, ignoreFiles).map((fileName) =>
    TokenMetadata.readFromFile(path.join(folderPath, fileName)),
  );
};
export const readChainMetadataFolder = (
  folderPath: string,
  ignoreFiles: string[] = [],
): ChainMetadata[] => {
  return scanMetadataFolder(folderPath, ignoreFiles).map((fileName) =>
    ChainMetadata.readFromFile(path.join(folderPath, fileName)),
  );
};

export const readDeploymentFolder = (
  rootFolderPath: string,
  ignoreFolders: string[] = [],
): DeploymentInfo[] => {
  const deploymentFolderPaths = fs
    .readdirSync(rootFolderPath)
    .filter((folderName) => !ignoreFolders.includes(folderName))
    .map((folderName) => path.join(rootFolderPath, folderName));

  return deploymentFolderPaths.map((folderPath) => DeploymentInfo.readFromDirectory(folderPath));
};

export const getEnvironmentForFolder = (folderName: string): Environment => {
  return folderName.endsWith('mainnet')
    ? 'production'
    : folderName.endsWith('ganache-local')
    ? 'development'
    : 'staging';
};
