import type { ProgramOptions } from "@/cli/programs/prove-op-message";
import { OPMessageProverProgram } from "@/cli/programs/prove-op-message";
import { getNetworkId } from "@/common/network";
import { OptimismRelayerService } from "@/services";
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
  l2RpcUrl: getRandomUrl("l2.from"),
  walletPrivateKey: getRandomPrivateKey(),
  l2TransactionHash: getRandomTransactionHash(),
};

const OPTIMISM_MAINNET_NETWORK_ID = 10;

describe("OPMessageProverProgram", () => {
  describe("validateArgs", () => {
    it("gives no error for valid ProgramOptions", () => {
      const errors = OPMessageProverProgram.validateArgs(validOptions);
      expect(errors).toEqual([]);
    });

    it("gives an error for invalid transactions hashes", () => {
      const invalidTransactionHashes = [
        getRandomTransactionHash() + "A",
        getRandomTransactionHash().slice(2),
      ];

      for (const hash of invalidTransactionHashes) {
        const errors = OPMessageProverProgram.validateArgs(
          Object.assign({}, validOptions, { l2TransactionHash: hash }),
        );

        expect(errors).toEqual([
          `Invalid argument value for "--l2-transaction-hash": "${hash}" doesn't look like a txn hash...`,
        ]);
      }
    });
  });

  it("can be created from args", async () => {
    const fromChainId = Number(Object.keys[OPTIMISM_MAINNET_NETWORK_ID]);

    (getNetworkId as jest.Mock).mockResolvedValueOnce(fromChainId);

    const program = await OPMessageProverProgram.createFromArgs(validOptions);

    expect(program.l2RelayerFrom instanceof OptimismRelayerService).toBe(true);
    expect(program.l2TransactionHash).toBe(validOptions.l2TransactionHash);
  });

  describe("run()", () => {
    it("runs all the necessary methods for successful proving of a transaction", async () => {
      const fromChainId = Number(Object.keys(SERVICES)[OPTIMISM_MAINNET_NETWORK_ID]);
      const L1ChainId = 1;

      (getNetworkId as jest.Mock)
        .mockResolvedValueOnce(fromChainId)
        .mockResolvedValueOnce(L1ChainId);

      const program = await OPMessageProverProgram.createFromArgs(validOptions);

      jest.spyOn(program.l2RelayerFrom, "waitAndProveMessage").mockResolvedValue(undefined);

      await program.run();

      expect(program.l2RelayerFrom.waitAndProveMessage).toHaveBeenCalledWith(
        program.l2TransactionHash,
      );
    });
  });
});
