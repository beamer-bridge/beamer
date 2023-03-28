import path from 'path';

import { readFileJsonContent } from './utils';

export class DeploymentInfo {
  readonly folderName: string;
  readonly beamer_commit: string;
  readonly deployer: string;
  readonly base_chain: ChainDeploymentInfo;
  readonly chains: ChainDeploymentMapping;

  constructor(data: DeploymentInfoData) {
    this.beamer_commit = data.beamer_commit;
    this.deployer = data.deployer;
    this.base_chain = data.base_chain;
    this.chains = data.chains;
    this.folderName = data.folderName;
  }

  public getMintableTokenAddresses(): Record<string, string> {
    return Object.keys(this.chains)
      .map((chainId) => {
        return {
          [chainId]: this.chains[chainId]['MintableToken']?.address,
        };
      })
      .reduce((previousValue, currentValue) => Object.assign(previousValue, currentValue), {});
  }

  get supportedChains(): string[] {
    return Object.keys(this.chains);
  }

  public formatChainDeploymentInfo(chainId: string): NormalizedChainDeploymentInfo {
    const chainDeploymentInfo = this.chains[chainId];
    return {
      identifier: Number(chainId),
      requestManagerAddress: chainDeploymentInfo['RequestManager'].address,
      fillManagerAddress: chainDeploymentInfo['FillManager'].address,
    };
  }

  static readFromFile(filePath: string): DeploymentInfo {
    try {
      return new this({
        ...(readFileJsonContent(filePath) as DeploymentInfoFile),
        folderName: path.dirname(filePath),
      });
    } catch (e) {
      throw new Error(`[DeploymentInfo]: Failed parsing ${filePath}.`);
    }
  }
}
export type ContractDeployedAddress = string; // Todo: improve restriction

export type ContractDeploymentInfo = {
  address: string;
  deployment_block?: number;
  deployment_args?: Array<string>;
};

export type ChainDeploymentInfo = {
  [contract: string]: ContractDeploymentInfo;
};

export type ChainDeploymentMapping = {
  [chainId: string]: ChainDeploymentInfo;
};

export type DeploymentInfoData = DeploymentInfoFile & {
  folderName: string;
};

export type DeploymentInfoFile = {
  beamer_commit: string;
  deployer: string;
  base_chain: ChainDeploymentInfo;
  chains: ChainDeploymentMapping;
};
export type NormalizedChainDeploymentInfo = {
  identifier: number;
  requestManagerAddress: ContractDeployedAddress;
  fillManagerAddress: ContractDeployedAddress;
};
