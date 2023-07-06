import type { ChainWithTokens } from '@/types/config';
import type { NativeCurrency } from '@/types/data';

import type { TokenMetadata } from '../tokens/token';
import { readFileJsonContent } from '../utils';

export class ChainMetadata {
  readonly identifier: number;
  readonly explorerUrl: string;
  readonly rpcUrl: string;
  readonly name: string;
  readonly tokenSymbols: Array<string>;
  readonly internalRpcUrl: string;
  readonly feeSubAddress?: string;
  readonly nativeCurrency?: NativeCurrency;
  readonly imageUrl?: string;
  readonly disabled?: boolean;
  readonly disabled_reason?: string;
  readonly hidden?: boolean;

  constructor(data: ChainMetadataData) {
    this.identifier = data.identifier;
    this.explorerUrl = data.explorerUrl;
    this.rpcUrl = data.rpcUrl;
    this.name = data.name;
    this.imageUrl = data.imageUrl;
    this.tokenSymbols = data.tokenSymbols ?? [];
    this.nativeCurrency = data.nativeCurrency;
    this.internalRpcUrl = data.internalRpcUrl;
    this.feeSubAddress = data.feeSubAddress;
    this.disabled = data.disabled;
    this.disabled_reason = data.disabled_reason;
    this.hidden = data.hidden;
  }

  public formatUsingTokenMetas(tokenMetas: TokenMetadata[]): Partial<ChainWithTokens> {
    const chainId = String(this.identifier);
    const tokens = tokenMetas
      .filter((tokenMeta) =>
        this.tokenSymbols.some(
          (symbol) => tokenMeta.symbol.toLowerCase() === symbol.toLowerCase(),
        ),
      )
      .filter((tokenMeta) => tokenMeta.isChainSupported(chainId))
      .map((tokenMeta) => tokenMeta.formatByChainId(chainId));

    return {
      ...this,
      tokens: tokens,
    };
  }

  static readFromFile(filePath: string): ChainMetadata {
    try {
      return new this(readFileJsonContent(filePath) as ChainMetadataData);
    } catch (e) {
      throw new Error(`[ChainMetadata]: Failed parsing ${filePath}.`);
    }
  }
}

export type ChainMetadataData = {
  identifier: number;
  explorerUrl: string;
  rpcUrl: string;
  name: string;
  tokenSymbols: Array<string>;
  internalRpcUrl: string;
  nativeCurrency?: NativeCurrency;
  feeSubAddress?: string;
  imageUrl?: string;
  disabled?: boolean;
  disabled_reason?: string;
  hidden?: boolean;
};
