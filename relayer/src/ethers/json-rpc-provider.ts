import type { TransactionRequest } from "@ethersproject/providers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber } from "ethers";
import type { Deferrable } from "ethers/lib/utils";

/**
 * Abstraction around the ethers JsonRpcProvider in order to gain
 * flexibility around the internal implementation of certain functions.
 *
 * At this moment, we are mainly using it to override all the `estimateGas` calls
 * so we can increase the gas used in every call by a certain %.
 * With this we are trying to avoid failed transactions due to dynamic gas estimations.
 * An example for this can be found on the Optimism Bedrock network.
 * Read more here: https://community.optimism.io/docs/developers/bedrock/how-is-bedrock-different/#deposits-from-ethereum-to-optimism
 */
export class ExtendedJsonRpcProvider extends JsonRpcProvider {
  private _bufferSizePercent = 50;

  get bufferSizePercent() {
    return this._bufferSizePercent;
  }

  public setBufferSize(bufferSizePercent: number) {
    this._bufferSizePercent = bufferSizePercent;
  }

  public getGasWithBuffer(gas: BigNumber, bufferSizePercent: number): BigNumber {
    const originalGas = BigNumber.from(gas);
    const bufferMultiplier = 100 + bufferSizePercent;
    return originalGas.mul(bufferMultiplier).div(100);
  }

  public async estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber> {
    const estimatedGas = await super.estimateGas(transaction);
    return this.getGasWithBuffer(estimatedGas, this._bufferSizePercent);
  }
}
