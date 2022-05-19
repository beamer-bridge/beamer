import { ETH, Token } from '@/types/data';
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

  get formattedAmount(): string {
    return `${this.decimalAmount} ${this.token.symbol}`;
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
