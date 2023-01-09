import { BigNumber, utils } from 'ethers';

import type { Encodable } from '@/types/encoding';

export enum EXCEPTIONS {
  CONSTRUCT_NEGATIVE_VALUE = 'Cannot create UInt256 from a negative number',
}

export class UInt256 implements Encodable<UInt256Data> {
  private value: BigNumber;

  constructor(data: UInt256Data) {
    const value = BigNumber.from(data);

    if (value.isNegative()) {
      throw new Error(EXCEPTIONS.CONSTRUCT_NEGATIVE_VALUE);
    }

    this.value = value;
  }

  static parse(value: string, decimals?: number): UInt256 {
    return new this(utils.parseUnits(value, decimals ?? 0).toString());
  }

  get asString(): string {
    return this.value.toString();
  }

  get asNumber(): number {
    return this.value.toNumber();
  }

  get asBigNumber(): BigNumber {
    return this.value;
  }

  public format(decimals: number): string {
    return utils.formatUnits(this.value, decimals);
  }

  public encode(): UInt256Data {
    return this.asString;
  }

  public add(value: UInt256): UInt256 {
    return new UInt256(this.value.add(value.value).toString());
  }

  public subtract(value: UInt256): UInt256 {
    return new UInt256(this.value.sub(value.value).toString());
  }

  public multiply(value: UInt256): UInt256 {
    return new UInt256(this.value.mul(value.value).toString());
  }

  public divide(value: UInt256): UInt256 {
    return new UInt256(this.value.div(value.value).toString());
  }

  public isZero(): boolean {
    return this.value.isZero();
  }

  public lt(value: UInt256): boolean {
    return this.value.lt(value.value);
  }

  public lte(value: UInt256): boolean {
    return this.value.lte(value.value);
  }

  public gte(value: UInt256): boolean {
    return this.value.gte(value.value);
  }
}

export type UInt256Data = string | number;
