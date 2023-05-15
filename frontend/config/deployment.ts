import fs from 'fs';
import path from 'path';

import { readFileJsonContent } from './utils';

export class DeploymentInfo {
  readonly chains: DeploymentInfoFiles;
  readonly folderName: string;

  constructor(data: DeploymentInfoData) {
    this.chains = data.chains;
    this.folderName = data.folderName;
  }

  public getMintableTokenAddresses(): Record<string, string> {
    return Object.keys(this.chains)
      .map((chainId) => {
        const tokenInfo = this.chains[chainId].chain.MintableToken;
        return tokenInfo
          ? {
              [chainId]: tokenInfo.address,
            }
          : {};
      })
      .reduce((previousValue, currentValue) => Object.assign(previousValue, currentValue), {});
  }

  get supportedChains(): string[] {
    return Object.keys(this.chains);
  }

  public formatChainDeploymentInfo(chainId: string): NormalizedChainDeploymentInfo {
    const chainDeploymentInfo = this.chains[chainId].chain;
    return {
      identifier: Number(chainId),
      requestManagerAddress: chainDeploymentInfo.RequestManager.address,
      fillManagerAddress: chainDeploymentInfo.FillManager.address,
    };
  }

  static readFromDirectory(folderPath: string): DeploymentInfo {
    try {
      const data: DeploymentInfoFiles = {};
      for (const fileName of fs.readdirSync(folderPath)) {
        const idPrefixedMatches = fileName.match(/^\d+/);
        if (!idPrefixedMatches || idPrefixedMatches.length > 1) {
          continue;
        }
        const chainId = idPrefixedMatches[0];
        const deploymentInfoFile = readFileJsonContent(
          path.join(folderPath, fileName),
        ) as DeploymentInfoFile;
        data[chainId] = deploymentInfoFile;
      }
      return new this({ chains: data, folderName: folderPath });
    } catch (e) {
      throw new Error(`[DeploymentInfo]: Failed parsing ${folderPath}.`);
    }
  }
}
export type ContractDeployedAddress = string; // Todo: improve restriction

export type ContractDeploymentInfo = {
  address: ContractDeployedAddress;
};

export type ChainDeploymentInfo = {
  MintableToken?: ContractDeploymentInfo;
  RequestManager: ContractDeploymentInfo;
  FillManager: ContractDeploymentInfo;
};

export type DeploymentInfoFile = {
  chain: ChainDeploymentInfo;
};

export type DeploymentInfoFiles = {
  [chain_id: string]: DeploymentInfoFile;
};

export type DeploymentInfoData = {
  chains: DeploymentInfoFiles;
  folderName: string;
};

export type NormalizedChainDeploymentInfo = {
  identifier: number;
  requestManagerAddress: ContractDeployedAddress;
  fillManagerAddress: ContractDeployedAddress;
};
