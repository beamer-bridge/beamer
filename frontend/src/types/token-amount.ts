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

    if (!this.amount.isZero()) {
      const beforeDot = formattedAmount.split('.')[0];
      const smallerThanOne = beforeDot === '0';
      const reducedDecimalSize = 5 - beforeDot.length >= 2 ? 5 - beforeDot.length : 2;
      const decimalPlaces = options?.decimalPlaces ?? (smallerThanOne ? 8 : reducedDecimalSize);
      const totalLength = beforeDot.length + decimalPlaces + 1;
      formattedAmount = formattedAmount.slice(0, totalLength);

      const formattedAfterDot = formattedAmount.split('.')[1];
      if (smallerThanOne && /^0+$/.test(formattedAfterDot)) {
        formattedAmount = '<' + formattedAmount.slice(0, totalLength - 1) + '1';
      }
    }

    if (options?.withSymbol ?? true) {
      formattedAmount += ` ${this.token.symbol}`;
    }

    return formattedAmount;
  }

  public formatFullValue(): string {
    return this.format({ decimalPlaces: this.token.decimals });
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
