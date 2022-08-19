import path from 'path';

import type { EthereumAddress, Token } from '@/types/data';

import { readFileJsonContent, writeToFile } from '../utils';

export class TokenMetadata {
  readonly symbol: string;
  readonly decimals: number;
  readonly addresses: TokenAddresses;
  readonly imageUrl?: string;

  constructor(data: TokenMetadataData) {
    this.symbol = data.symbol;
    this.decimals = data.decimals;
    this.addresses = data.addresses;
    this.imageUrl = data.imageUrl;
  }

  public isChainSupported(chainId: string): boolean {
    return !!this.addresses[chainId];
  }

  public formatByChainId(chainId: string): Token {
    if (!this.isChainSupported(chainId)) {
      console.warn(`Chain ${chainId} not supported for token ${this.symbol}!`);
    }

    return {
      symbol: this.symbol,
      decimals: this.decimals,
      imageUrl: this.imageUrl,
      address: this.addresses[chainId],
    };
  }

  public addAddresses(addresses: TokenAddresses): void {
    Object.entries(addresses).forEach(([chainId, address]) => this.addAddress(chainId, address));
  }

  public addAddress(chainId: string, address: string): void {
    if (this.isChainSupported(chainId)) {
      console.warn(
        `Updating address for token "${this.symbol}" on chain ${chainId}: ${this.addresses[chainId]} -> ${address}`,
      );
    }

    this.addresses[chainId] = address;
  }

  static readFromFile(filePath: string): TokenMetadata {
    try {
      return new this(readFileJsonContent(filePath) as TokenMetadataData);
    } catch (e) {
      throw new Error(`[TokenMetadata]: Failed parsing ${filePath}.`);
    }
  }

  public flushTo(folderPath: string): void {
    writeToFile(path.join(folderPath, `${this.symbol}.json`), JSON.stringify(this));
  }
}

export type TokenAddresses = { [chainId: string]: EthereumAddress };

export type TokenMetadataData = {
  symbol: string;
  decimals: number;
  addresses: TokenAddresses;
  imageUrl?: string;
};
