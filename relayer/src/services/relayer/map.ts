import type { BaseRelayerService, ExtendedRelayerService } from "../types";
import { ArbitrumRelayerService } from "./arbitrum";
import { BobaRelayerService } from "./boba";
import { EthereumRelayerService } from "./ethereum";
import { OptimismRelayerService } from "./optimism";
import { PolygonZKEvmRelayerService } from "./polygon-zkevm";

export const SERVICES: Record<number, ExtendedRelayerService> = {
  42161: ArbitrumRelayerService,
  421613: ArbitrumRelayerService,
  412346: ArbitrumRelayerService,
  2888: BobaRelayerService,
  288: BobaRelayerService,
  10: OptimismRelayerService,
  420: OptimismRelayerService,
  901: OptimismRelayerService,
  1: EthereumRelayerService,
  5: EthereumRelayerService,
  1337: EthereumRelayerService,
  1101: PolygonZKEvmRelayerService,
  1442: PolygonZKEvmRelayerService,
  1001: PolygonZKEvmRelayerService,
  // OP forks
  84531: OptimismRelayerService,
  8453: OptimismRelayerService,
};

export function createRelayer(
  networkId: number,
  args: ConstructorParameters<typeof BaseRelayerService>,
): BaseRelayerService {
  const Relayer = SERVICES[networkId];

  if (Relayer) {
    return new Relayer(...args);
  } else {
    const errorMessage = `No relayer program found for ${networkId}!`;
    throw new Error(errorMessage);
  }
}
