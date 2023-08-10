import type { ProgramOptions } from "@/cli/programs/relay";
import { RelayerProgram } from "@/cli/programs/relay";
import { getNetworkId } from "@/common/network";
import type { ArbitrumRelayerService, PolygonZKEvmRelayerService } from "@/services";
import { SERVICES } from "@/services/relayer/map";
import {
  getAccountPassword,
  getKeystoreFilePath,
  getRandomTransactionHash,
  getRandomUrl,
} from "~/utils/data_generators";

jest.mock("@/common/network");
jest.mock("@eth-optimism/sdk");

const validOptions: ProgramOptions = {
  l1RpcUrl: getRandomUrl("l1"),
  l2RelayFromRpcUrl: getRandomUrl("l2.from"),
  l2RelayToRpcUrl: getRandomUrl("l2.to"),
  keystoreFile: getKeystoreFilePath(),
  password: getAccountPassword(),
  l2TransactionHash: getRandomTransactionHash(),
};

const L1_CHAIN_ID = 1;

describe("RelayerProgram", () => {
  describe("validateArgs", () => {
    it("gives no error for valid ProgramOptions", () => {
      const errors = RelayerProgram.validateArgs(validOptions);
      expect(errors).toEqual([]);
    });

    it("gives an error for invalid transactions hashes", () => {
      const invalidTransactionHashes = [
        getRandomTransactionHash() + "A",
        getRandomTransactionHash().slice(2),
      ];

      for (const hash of invalidTransactionHashes) {
        const errors = RelayerProgram.validateArgs(
          Object.assign({}, validOptions, { l2TransactionHash: hash }),
        );

        expect(errors).toEqual([
          `Invalid argument value for "--l2-transaction-hash": "${hash}" doesn't look like a txn hash...`,
        ]);
      }
    });
  });

  it("can be created from args", async () => {
    const fromChainId = Number(Object.keys(SERVICES)[0]);
    const toChainId = Number(Object.keys(SERVICES)[3]);

    (getNetworkId as jest.Mock)
      .mockResolvedValueOnce(fromChainId)
      .mockResolvedValueOnce(toChainId)
      .mockResolvedValueOnce(L1_CHAIN_ID);

    const program = await RelayerProgram.createFromArgs(validOptions);

    expect(program.l2RelayerFrom instanceof SERVICES[fromChainId]).toBe(true);
    expect(program.l2RelayerTo instanceof SERVICES[toChainId]).toBe(true);
    expect(program.l2TransactionHash).toBe(validOptions.l2TransactionHash);
  });

  describe("createFromArgs()", () => {
    it("creates a relayer service for each direction and initializes them with the right values", async () => {
      const fromChainId = Number(Object.keys(SERVICES)[0]);
      const toChainId = Number(Object.keys(SERVICES)[3]);

      (getNetworkId as jest.Mock)
        .mockResolvedValueOnce(fromChainId)
        .mockResolvedValueOnce(toChainId)
        .mockResolvedValueOnce(L1_CHAIN_ID);

      const program = await RelayerProgram.createFromArgs(validOptions);

      const relayerFrom = program.l2RelayerFrom;
      const relayerTo = program.l2RelayerTo;

      expect(relayerFrom.l1ChainId).toBe(L1_CHAIN_ID);
      expect(relayerFrom.l2ChainId).toBe(fromChainId);
      expect(relayerFrom.destinationChainId).toBe(toChainId);

      expect(relayerTo.l1ChainId).toBe(L1_CHAIN_ID);
      expect(relayerTo.l2ChainId).toBe(toChainId);
      expect(relayerTo.destinationChainId).toBe(fromChainId);
    });
  });

  describe("run()", () => {
    it("runs all the necessary methods for successful relaying of a transaction", async () => {
      const fromChainId = 1101;
      const toChainId = 42161;
      (getNetworkId as jest.Mock)
        .mockResolvedValueOnce(fromChainId)
        .mockResolvedValueOnce(toChainId)
        .mockResolvedValueOnce(L1_CHAIN_ID);

      const program = await RelayerProgram.createFromArgs(validOptions);
      const relayerFrom = program.l2RelayerFrom as PolygonZKEvmRelayerService;
      const relayerTo = program.l2RelayerTo as ArbitrumRelayerService;

      jest.spyOn(relayerTo.prepareStep, "execute").mockResolvedValue();
      jest.spyOn(relayerTo.prepareStep, "isCompleted").mockResolvedValue(false);
      jest
        .spyOn(relayerFrom.relayTxToL1Step, "execute")
        .mockResolvedValue(getRandomTransactionHash());
      jest.spyOn(relayerFrom.relayTxToL1Step, "isCompleted").mockResolvedValue(false);
      jest.spyOn(relayerTo.finalizeStep, "execute").mockResolvedValue();
      jest.spyOn(relayerTo.finalizeStep, "isCompleted").mockResolvedValue(false);

      await program.run();

      expect(relayerTo.prepareStep.execute).toHaveBeenCalled();
      expect(relayerFrom.relayTxToL1Step.execute).toHaveBeenCalled();
      expect(relayerTo.finalizeStep.execute).toHaveBeenCalled();
    });

    it("ignores the `finalize` step when it is completed already", async () => {
      const fromChainId = 1101;
      const toChainId = 42161;
      (getNetworkId as jest.Mock)
        .mockResolvedValueOnce(fromChainId)
        .mockResolvedValueOnce(toChainId)
        .mockResolvedValueOnce(L1_CHAIN_ID);

      const program = await RelayerProgram.createFromArgs(validOptions);
      const relayerFrom = program.l2RelayerFrom as PolygonZKEvmRelayerService;
      const relayerTo = program.l2RelayerTo as ArbitrumRelayerService;

      jest.spyOn(relayerTo.prepareStep, "execute").mockResolvedValue();
      jest.spyOn(relayerTo.prepareStep, "isCompleted").mockResolvedValue(false);
      jest
        .spyOn(relayerFrom.relayTxToL1Step, "execute")
        .mockResolvedValue(getRandomTransactionHash());
      jest.spyOn(relayerFrom.relayTxToL1Step, "isCompleted").mockResolvedValue(false);
      jest.spyOn(relayerTo.finalizeStep, "execute").mockResolvedValue();
      jest.spyOn(relayerTo.finalizeStep, "isCompleted").mockResolvedValue(true);

      await program.run();

      expect(relayerTo.prepareStep.execute).toHaveBeenCalled();
      expect(relayerFrom.relayTxToL1Step.execute).toHaveBeenCalled();
      expect(relayerTo.finalizeStep.isCompleted).toHaveBeenCalled();
      expect(relayerTo.finalizeStep.execute).not.toHaveBeenCalled();
    });

    it("ignores the `prepare` step when `relay` step is completed already", async () => {
      const fromChainId = 1101;
      const toChainId = 42161;
      (getNetworkId as jest.Mock)
        .mockResolvedValueOnce(fromChainId)
        .mockResolvedValueOnce(toChainId)
        .mockResolvedValueOnce(L1_CHAIN_ID);

      const program = await RelayerProgram.createFromArgs(validOptions);
      const relayerFrom = program.l2RelayerFrom as PolygonZKEvmRelayerService;
      const relayerTo = program.l2RelayerTo as ArbitrumRelayerService;

      jest.spyOn(relayerTo.prepareStep, "execute").mockResolvedValue();
      jest.spyOn(relayerTo.prepareStep, "isCompleted").mockResolvedValue(false);
      jest
        .spyOn(relayerFrom.relayTxToL1Step, "execute")
        .mockResolvedValue(getRandomTransactionHash());
      jest.spyOn(relayerFrom.relayTxToL1Step, "isCompleted").mockResolvedValue(true);
      jest
        .spyOn(relayerFrom.relayTxToL1Step, "recoverL1TransactionHash")
        .mockResolvedValue(getRandomTransactionHash());
      jest.spyOn(relayerTo.finalizeStep, "execute").mockResolvedValue();
      jest.spyOn(relayerTo.finalizeStep, "isCompleted").mockResolvedValue(false);

      await program.run();

      expect(relayerTo.prepareStep.execute).not.toHaveBeenCalled();
      expect(relayerFrom.relayTxToL1Step.execute).not.toHaveBeenCalled();
      expect(relayerFrom.relayTxToL1Step.recoverL1TransactionHash).toHaveBeenCalled();
      expect(relayerTo.finalizeStep.execute).toHaveBeenCalled();
    });
  });
});
