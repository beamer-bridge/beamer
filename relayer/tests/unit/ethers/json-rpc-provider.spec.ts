import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber } from "ethers";

import { ExtendedJsonRpcProvider } from "@/ethers/json-rpc-provider";

jest.mock("@ethersproject/providers");

describe("ExtendedJsonRpcProvider", () => {
  describe("bufferSizePercent", () => {
    it("stores a percentage value that represents the size of the buffer (out of the total estimated gas) that will be used to increase every gas estimation", () => {
      const rpcProvider = new ExtendedJsonRpcProvider();
      expect(rpcProvider.bufferSizePercent).not.toBeUndefined();
    });
    it("holds a default value of 50", () => {
      const rpcProvider = new ExtendedJsonRpcProvider();
      expect(rpcProvider.bufferSizePercent).toBe(50);
    });
  });
  describe("setBufferSize()", () => {
    it("allows setting a different value for bufferSizePercent", () => {
      const rpcProvider = new ExtendedJsonRpcProvider();
      const bufferSizePercent = 90;
      rpcProvider.setBufferSize(bufferSizePercent);
      expect(rpcProvider.bufferSizePercent).toBe(bufferSizePercent);
    });
  });

  describe("getGasWithBuffer", () => {
    it("increases the provided gas value by a specific percent", () => {
      const rpcProvider = new ExtendedJsonRpcProvider();
      const bufferSizePercent = 50;
      const gas = BigNumber.from(1_000_000);
      const gasWithBuffer = rpcProvider.getGasWithBuffer(gas, bufferSizePercent);
      expect(gasWithBuffer.toNumber()).toBe((gas.toNumber() * (100 + bufferSizePercent)) / 100);
    });

    it("doesn't increase the gas value when provided a 0 percent buffer", () => {
      const rpcProvider = new ExtendedJsonRpcProvider();
      const bufferSizePercent = 0;
      const gas = BigNumber.from(1_000_000);
      const gasWithBuffer = rpcProvider.getGasWithBuffer(gas, bufferSizePercent);
      expect(gasWithBuffer.toNumber()).toBe(gas.toNumber());
    });
  });

  describe("estimateGas()", () => {
    it("overrides the original estimateGas function of JsonRpcProvider for adding support for buffer addition", async () => {
      const rpcProvider = new ExtendedJsonRpcProvider();
      const bufferSizePercent = 50;
      rpcProvider.setBufferSize(bufferSizePercent);

      const originalGasEstimation = 1_000_000;
      jest
        .spyOn(JsonRpcProvider.prototype, "estimateGas")
        .mockResolvedValue(BigNumber.from(originalGasEstimation));

      const estimatedGas = await rpcProvider.estimateGas({});
      expect(estimatedGas.toNumber()).toBe(
        (originalGasEstimation * (100 + bufferSizePercent)) / 100,
      );
    });
  });
});
