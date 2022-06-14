import type { Token } from '@/types/data';
import { ETH } from '@/types/data';
import type { Encodable } from '@/types/encoding';
import type { UInt256Data } from '@/types/uint-256';
import { UInt256 } from '@/types/uint-256';

export class TokenAmount implements Encodable<TokenAmountData> {
  readonly token: Token;
  private amount: UInt256;

  constructor(data: TokenAmountData) {
    this.token = data.token;
    this.amount = new UInt256(data.amount);
  }

  static new(amount: UInt256, token: Token) {
    return new this({ amount: amount.asString, token });
  }

  static parse(value: string, token: Token) {
    const amount = UInt256.parse(value, token.decimals).encode();
    return new this({ amount, token });
  }

  get uint256(): UInt256 {
    return this.amount;
  }

  get decimalAmount(): string {
    return this.amount.format(this.token.decimals);
  }

  public format(options?: { decimalPlaces?: number; withSymbol?: boolean }): string {
    let formattedAmount = this.decimalAmount;

    if (options?.decimalPlaces) {
      const beforeDot = formattedAmount.split('.')[0];
      const totalLength = beforeDot.length + options.decimalPlaces + 1;
      formattedAmount = formattedAmount.slice(0, totalLength);
    }

    if (options?.withSymbol ?? true) {
      formattedAmount += ` ${this.token.symbol}`;
    }

    return formattedAmount;
  }

  public encode(): TokenAmountData {
    return {
      token: this.token,
      amount: this.amount.encode(),
    };
  }
}

export type TokenAmountData = {
  token: Token;
  amount: UInt256Data;
};

export class EthereumAmount extends TokenAmount {
  constructor(amount: UInt256Data) {
    super({ token: ETH, amount });
  }

  static parse(value: string) {
    return TokenAmount.parse(value, ETH);
  }
}
