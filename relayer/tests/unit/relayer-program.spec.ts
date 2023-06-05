import type { ProgramOptions } from "@/cli/programs/relay";
import { RelayerProgram, validateArgs } from "@/cli/programs/relay";
import { getNetworkId } from "@/common/network";
import { SERVICES } from "@/services/relayer/map";
import {
  getRandomPrivateKey,
  getRandomTransactionHash,
  getRandomUrl,
} from "~/utils/data_generators";

jest.mock("@/common/network");
jest.mock("@eth-optimism/sdk");

const validOptions: ProgramOptions = {
  l1RpcUrl: getRandomUrl("l1"),
  l2RelayFromRpcUrl: getRandomUrl("l2.from"),
  l2RelayToRpcUrl: getRandomUrl("l2.to"),
  walletPrivateKey: getRandomPrivateKey(),
  l2TransactionHash: getRandomTransactionHash(),
};

describe("validateArgs", () => {
  it("gives no error for valid ProgramOptions", () => {
    const errors = validateArgs(validOptions);
    expect(errors).toEqual([]);
  });

  it("gives an error for invalid transactions hashes", () => {
    const invalidTransactionHashes = [
      getRandomTransactionHash() + "A",
      getRandomTransactionHash().slice(2),
    ];

    for (const hash of invalidTransactionHashes) {
      const errors = validateArgs(Object.assign({}, validOptions, { l2TransactionHash: hash }));

      expect(errors).toEqual([
        `Invalid argument value for "--l2-transaction-hash": "${hash}" doesn't look like a txn hash...`,
      ]);
    }
  });
});

describe("RelayerProgram", () => {
  it("can be created from args", async () => {
    const fromChainId = Number(Object.keys(SERVICES)[0]);
    const toChainId = Number(Object.keys(SERVICES)[3]);

    (getNetworkId as jest.Mock)
      .mockResolvedValueOnce(fromChainId)
      .mockResolvedValueOnce(toChainId);

    const program = await RelayerProgram.createFromArgs(validOptions);

    expect(program.l2RelayerFrom instanceof SERVICES[fromChainId]).toBe(true);
    expect(program.l2RelayerTo instanceof SERVICES[toChainId]).toBe(true);
    expect(program.l2TransactionHash).toBe(validOptions.l2TransactionHash);
  });

  describe("run()", () => {
    it("runs all the necessary methods for successful relaying of a transaction", async () => {
      const fromChainId = Number(Object.keys(SERVICES)[0]);
      const toChainId = Number(Object.keys(SERVICES)[3]);
      (getNetworkId as jest.Mock)
        .mockResolvedValueOnce(fromChainId)
        .mockResolvedValueOnce(toChainId);

      const program = await RelayerProgram.createFromArgs(validOptions);

      jest.spyOn(program.l2RelayerTo, "prepare");
      jest
        .spyOn(program.l2RelayerFrom, "relayTxToL1")
        .mockResolvedValue(getRandomTransactionHash());
      jest.spyOn(program.l2RelayerTo, "finalize");

      await program.run();

      expect(program.l2RelayerTo.prepare).toHaveBeenCalled();
      expect(program.l2RelayerFrom.relayTxToL1).toHaveBeenCalled();
      expect(program.l2RelayerTo.finalize).toHaveBeenCalled();
    });

    it("ignores the `finalize` step when l1 transaction hash was not returned by the `relayTxToL1` step", async () => {
      const fromChainId = Number(Object.keys(SERVICES)[0]);
      const toChainId = Number(Object.keys(SERVICES)[3]);
      (getNetworkId as jest.Mock)
        .mockResolvedValueOnce(fromChainId)
        .mockResolvedValueOnce(toChainId);

      const program = await RelayerProgram.createFromArgs(validOptions);

      jest.spyOn(program.l2RelayerTo, "prepare");
      jest.spyOn(program.l2RelayerFrom, "relayTxToL1").mockResolvedValue(undefined);
      jest.spyOn(program.l2RelayerTo, "finalize");

      await program.run();

      expect(program.l2RelayerTo.prepare).toHaveBeenCalled();
      expect(program.l2RelayerFrom.relayTxToL1).toHaveBeenCalled();
      expect(program.l2RelayerTo.finalize).not.toHaveBeenCalled();
    });
  });
});
