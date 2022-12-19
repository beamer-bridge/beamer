import { ArbitrumRelayerService, BobaRelayerService, OptimismRelayerService } from "./services";
import type { BaseRelayerService, BaseRelayerServiceConstructor } from "./services/types";

export const SERVICES: Record<number, BaseRelayerServiceConstructor> = {
  42161: ArbitrumRelayerService,
  421613: ArbitrumRelayerService,
  2888: BobaRelayerService,
  288: BobaRelayerService,
  10: OptimismRelayerService,
  420: OptimismRelayerService,
};

export function createRelayer(
  networkId: number,
  args: ConstructorParameters<BaseRelayerServiceConstructor>,
): BaseRelayerService {
  const Relayer = SERVICES[networkId];

  if (networkId) {
    return new Relayer(...args);
  } else {
    const errorMessage = `No relayer program found for ${networkId}!`;
    throw new Error(errorMessage);
  }
}
