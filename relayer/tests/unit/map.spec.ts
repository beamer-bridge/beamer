import {
  ArbitrumRelayerService,
  BobaRelayerService,
  EthereumRelayerService,
  OptimismRelayerService,
} from "@/services/relayer";
import { createRelayer } from "@/services/relayer/map";
import type { BaseRelayerService } from "@/services/types";
import { getRandomPrivateKey, getRandomUrl } from "~/utils/data_generators";

jest.mock("@eth-optimism/sdk");

function createTestArgs(
  l1ChainId: number,
  l2ChainId: number,
  destinationChainId?: number,
): ConstructorParameters<typeof BaseRelayerService> {
  return [
    getRandomUrl("l1"),
    getRandomUrl("l2"),
    getRandomPrivateKey(),
    l1ChainId,
    l2ChainId,
    destinationChainId,
  ];
}

describe("createRelayer", () => {
  it("maps Arbitrum chain ids to an ArbitrumRelayerService", () => {
    const chainId = 42161;
    const goerliChainId = 421613;
    const testnetChainId = 412346;

    const relayer = createRelayer(chainId, createTestArgs(1, chainId));
    const goerliRelayer = createRelayer(goerliChainId, createTestArgs(5, goerliChainId));
    const testnetRelayer = createRelayer(testnetChainId, createTestArgs(1337, testnetChainId));

    expect(relayer instanceof ArbitrumRelayerService).toBe(true);
    expect(goerliRelayer instanceof ArbitrumRelayerService).toBe(true);
    expect(testnetRelayer instanceof ArbitrumRelayerService).toBe(true);
  });

  it("maps Boba chain ids to an BobaRelayerService", () => {
    const chainId = 288;
    const goerliChainId = 2888;

    const relayer = createRelayer(chainId, createTestArgs(1, chainId));
    const goerliRelayer = createRelayer(goerliChainId, createTestArgs(5, goerliChainId));

    expect(relayer instanceof BobaRelayerService).toBe(true);
    expect(goerliRelayer instanceof BobaRelayerService).toBe(true);
  });

  it("maps Optimism chain ids to an OptimismRelayerService", () => {
    const chainId = 10;
    const goerliChainId = 420;

    const relayer = createRelayer(chainId, createTestArgs(1, chainId));
    const goerliRelayer = createRelayer(goerliChainId, createTestArgs(5, goerliChainId));

    expect(relayer instanceof OptimismRelayerService).toBe(true);
    expect(goerliRelayer instanceof OptimismRelayerService).toBe(true);
  });

  it("maps Ethereum chain ids to EthereumRelayerService", () => {
    const chainId = 1;
    const goerliChainId = 5;
    const localChainId = 1337;

    const relayer = createRelayer(chainId, createTestArgs(1, chainId));
    const goerliRelayer = createRelayer(goerliChainId, createTestArgs(5, goerliChainId));
    const localChainRelayer = createRelayer(localChainId, createTestArgs(1337, localChainId));

    expect(relayer instanceof EthereumRelayerService).toBe(true);
    expect(goerliRelayer instanceof EthereumRelayerService).toBe(true);
    expect(localChainRelayer instanceof EthereumRelayerService).toBe(true);
  });

  it("maps Base chain ids to OptimismRelayerService", () => {
    const chainId = 8453;
    const goerliChainId = 84531;

    const relayer = createRelayer(chainId, createTestArgs(1, chainId));
    const goerliRelayer = createRelayer(goerliChainId, createTestArgs(5, goerliChainId));

    expect(relayer instanceof OptimismRelayerService).toBe(true);
    expect(goerliRelayer instanceof OptimismRelayerService).toBe(true);
  });

  it("throws for unknown chain ids", () => {
    const chainId = 9372855;
    expect(() => createRelayer(chainId, createTestArgs(1, chainId))).toThrow(
      `No relayer program found for ${chainId}!`,
    );
  });
});
