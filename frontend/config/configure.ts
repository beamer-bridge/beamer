import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import path from 'path';

import type { BeamerConfig } from '@/types/config';

import type { ChainMetadata } from './chains/chain';
import type { DeploymentInfo } from './deployment';
import { configMappingSchema } from './schema';
import { TokenMetadata } from './tokens/token';
import type { BeamerConfigEnvMapping, Environment } from './types';
import {
  getEnvironmentForFolder,
  readChainMetadataFolder,
  readDeploymentFolder,
  readTokenMetadataFolder,
  writeToFile,
} from './utils';

const CHAINS_DIR = path.join(__dirname, 'chains');
const TOKENS_DIR = path.join(__dirname, 'tokens');
const DEPLOYMENT_DIR = path.join(__dirname, '../../deployments');
const OUTPUT_DIR = path.join(__dirname, '../public');

const ajv = new Ajv();
addFormats(ajv);

export const generateTestToken = (rootDeploymentFolder?: string): TokenMetadata => {
  const TST = new TokenMetadata({
    symbol: 'TST',
    decimals: 18,
    addresses: {},
  });

  const deploymentInfos = readDeploymentFolder(rootDeploymentFolder ?? DEPLOYMENT_DIR, [
    'mainnet',
  ]);

  const chainMintableTokenAddressMapping = {};

  for (const info of deploymentInfos) {
    Object.assign(chainMintableTokenAddressMapping, info.getMintableTokenAddresses());
  }

  TST.addAddresses(chainMintableTokenAddressMapping);

  return TST;
};

/**
 * Mixes deployment & metadata info
 */
export const generateAppConfig = (
  deploymentInfo: DeploymentInfo,
  chainMetas: ChainMetadata[],
  tokenMetas: TokenMetadata[],
): BeamerConfig => {
  const config = { chains: {} };

  const chainWithTokens = chainMetas.map((chainMeta) =>
    chainMeta.formatUsingTokenMetas(tokenMetas),
  );

  for (const chainId of deploymentInfo.supportedChains) {
    const chainMeta = chainWithTokens.find((chain) => chain.identifier == Number(chainId));
    // Avoid mixing chains that have no metadata
    if (!chainMeta) {
      continue;
    }

    Object.assign(config.chains, {
      [chainId]: {
        ...chainMeta,
        ...deploymentInfo.formatChainDeploymentInfo(chainId),
      },
    });
  }
  return config;
};

const run = (): void => {
  // Generate test token used on testnets and local net
  const TSTToken = generateTestToken();
  TSTToken.flushTo(TOKENS_DIR);

  // Generate all environment configs
  const configs: BeamerConfigEnvMapping = {
    development: { chains: {} },
    staging: { chains: {} },
    production: { chains: {} },
  };

  const tokenMetas = readTokenMetadataFolder(TOKENS_DIR);
  const chainMetas = readChainMetadataFolder(CHAINS_DIR);
  const deploymentInfos = readDeploymentFolder(DEPLOYMENT_DIR);

  for (const info of deploymentInfos) {
    Object.assign(
      configs[getEnvironmentForFolder(info.folderName)].chains,
      generateAppConfig(info, chainMetas, tokenMetas).chains,
    );
  }

  // Verify & write generated configs
  const validate = ajv.compile<BeamerConfigEnvMapping>(configMappingSchema);
  if (!validate(configs)) {
    throw new Error(ajv.errorsText(validate.errors));
  }

  for (const environment in configs) {
    const filePath = path.join(OUTPUT_DIR, `config.${environment}.json`);
    const configContent = JSON.stringify(configs[environment as Environment]);
    writeToFile(filePath, configContent);
  }
};

run();
