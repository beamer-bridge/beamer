import {
  ArbitrumRelayerService,
  BobaRelayerService,
  EthereumRelayerService,
  OptimismRelayerService,
} from "@/services/relayer";
import { createRelayer } from "@/services/relayer/map";
import type { BaseRelayerService } from "@/services/types";
import { getRandomNumber, getRandomPrivateKey, getRandomUrl } from "~/utils/data_generators";

jest.mock("@eth-optimism/sdk");

describe("createRelayer", () => {
  const testArgs: ConstructorParameters<typeof BaseRelayerService> = [
    getRandomUrl("l1"),
    getRandomUrl("l2"),
    getRandomPrivateKey(),
    getRandomNumber(),
    getRandomNumber(),
  ];

  it("maps arbitrum chain ids to an ArbitrumRelayerService", () => {
    const chainId = 42161;
    const goerliChainId = 421613;
    const testnetChainId = 412346;

    const relayer = createRelayer(chainId, testArgs);
    const goerliRelayer = createRelayer(goerliChainId, testArgs);
    const testnetRelayer = createRelayer(testnetChainId, testArgs);

    expect(relayer instanceof ArbitrumRelayerService).toBe(true);
    expect(goerliRelayer instanceof ArbitrumRelayerService).toBe(true);
    expect(testnetRelayer instanceof ArbitrumRelayerService).toBe(true);
  });

  it("maps boba chain ids to an BobaRelayerService", () => {
    const chainId = 288;
    const goerliChainId = 2888;

    const relayer = createRelayer(chainId, testArgs);
    const goerliRelayer = createRelayer(goerliChainId, testArgs);

    expect(relayer instanceof BobaRelayerService).toBe(true);
    expect(goerliRelayer instanceof BobaRelayerService).toBe(true);
  });

  it("maps optimism chain ids to an OptimismRelayerService", () => {
    const chainId = 10;
    const goerliChainId = 420;

    const relayer = createRelayer(chainId, testArgs);
    const goerliRelayer = createRelayer(goerliChainId, testArgs);

    expect(relayer instanceof OptimismRelayerService).toBe(true);
    expect(goerliRelayer instanceof OptimismRelayerService).toBe(true);
  });

  it("maps ethereum chain ids to EthereumRelayerService", () => {
    const chainId = 1;
    const goerliChainId = 5;
    const localChainId = 1337;

    const relayer = createRelayer(chainId, testArgs);
    const goerliRelayer = createRelayer(goerliChainId, testArgs);
    const localChainRelayer = createRelayer(localChainId, testArgs);

    expect(relayer instanceof EthereumRelayerService).toBe(true);
    expect(goerliRelayer instanceof EthereumRelayerService).toBe(true);
    expect(localChainRelayer instanceof EthereumRelayerService).toBe(true);
  });

  it("throws for unknown chain ids", () => {
    const chainId = 9372855;
    expect(() => createRelayer(chainId, testArgs)).toThrow(
      `No relayer program found for ${chainId}!`,
    );
  });
});
