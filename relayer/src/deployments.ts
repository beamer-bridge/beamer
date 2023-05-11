import { abi as FillManagerABI } from "@beamer-bridge/deployments/dist/abis/mainnet/FillManager.json";
import { chain as chainEthereumGoerli } from "@beamer-bridge/deployments/dist/artifacts/goerli/5-ethereum.deployment.json";
import { base as baseArbitrumGoerli } from "@beamer-bridge/deployments/dist/artifacts/goerli/421613-arbitrum.deployment.json";
import { base as baseGoerli } from "@beamer-bridge/deployments/dist/artifacts/goerli/base.deployment.json";
import { chain as chainEthereumMainnet } from "@beamer-bridge/deployments/dist/artifacts/mainnet/1-ethereum.deployment.json";
import { base as baseArbitrumMainnet } from "@beamer-bridge/deployments/dist/artifacts/mainnet/42161-arbitrum.deployment.json";
import { base as baseMainnet } from "@beamer-bridge/deployments/dist/artifacts/mainnet/base.deployment.json";

export const addresses = {
  goerli: {
    EthereumL2Messenger: chainEthereumGoerli.EthereumL2Messenger.address,
    ArbitrumL1Messenger: baseArbitrumGoerli.ArbitrumL1Messenger.address,
  },
  mainnet: {
    EthereumL2Messenger: chainEthereumMainnet.EthereumL2Messenger.address,
    ArbitrumL1Messenger: baseArbitrumMainnet.ArbitrumL1Messenger.address,
  },
};

export const contractsMeta = {
  goerli: {
    RESOLVER_DEPLOY_BLOCK_NUMBER: baseGoerli.Resolver.deployment_block,
  },
  mainnet: {
    RESOLVER_DEPLOY_BLOCK_NUMBER: baseMainnet.Resolver.deployment_block,
  },
};

export const abis = {
  FillManager: FillManagerABI,
};
