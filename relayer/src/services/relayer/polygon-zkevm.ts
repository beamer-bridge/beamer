import type { TransactionReceipt } from "@ethersproject/abstract-provider";
import { readFileSync } from "fs";

import { PolygonZKEvmBridge__factory } from "../../../types-gen/contracts";
import { parseBridgeEvent } from "../../common/events/polygon-zkevm/BridgeEvent";
import { sleep } from "../../common/util";
import type { TransactionHash } from "../types";
import { BaseRelayerService } from "../types";

const CONTRACTS: Record<number, NetworkContracts> = {
  1101: {
    l1: {
      PolygonZKEvmBridge: "0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe",
    },
    l2: {
      PolygonZKEvmBridge: "0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe",
    },
    bridgeServiceUrl: "https://bridge-api.zkevm-rpc.com",
  },
  1442: {
    l1: {
      PolygonZKEvmBridge: "0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7",
    },
    l2: {
      PolygonZKEvmBridge: "0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7",
    },
    bridgeServiceUrl: "https://bridge-api.public.zkevm-test.net",
  },
};
export class PolygonZKEvmRelayerService extends BaseRelayerService {
  MERKLE_PROOF_ENDPOINT = "/merkle-proof";
  BRIDGES_ENDPOINT = "/bridge";
  customNetworkContracts?: NetworkContracts;

  async getNetworkConfig(): Promise<NetworkContracts> {
    const l2NetworkId = await this.getL2ChainId();
    return this.customNetworkContracts ?? CONTRACTS[l2NetworkId];
  }

  async getMessageMerkleProof(
    depositCount: number,
    originNetwork: number,
  ): Promise<MerkleProofResponse> {
    const networkConfig = await this.getNetworkConfig();

    const merkleProofUrl = new URL(networkConfig.bridgeServiceUrl + this.MERKLE_PROOF_ENDPOINT);
    merkleProofUrl.searchParams.set("deposit_cnt", depositCount.toString());
    merkleProofUrl.searchParams.set("net_id", originNetwork.toString());

    const response = await fetch(merkleProofUrl);
    const responseJson = await response.json();

    if (responseJson.code && responseJson.message) {
      throw new Error(responseJson.message);
    }

    return responseJson;
  }

  async getMessageInfoSafe(
    depositCount: number,
    originNetwork: number /** 1 means Polygon ZkEVM (L2) and 0 means L1 */,
  ): Promise<PolygonZKEvmDeposit> {
    // Loop and retry until the endpoint returns a proper result;
    try {
      const response = await this.getMessageInfo(depositCount, originNetwork);
      return response;
    } catch (e) {
      if ((e as Error).message && (e as Error).message == "not found in the Storage") {
        await sleep(5000);
        return this.getMessageInfoSafe(depositCount, originNetwork);
      }
      throw e;
    }
  }

  async getMessageInfo(
    depositCount: number,
    originNetwork: number /** 1 means Polygon ZkEVM (L2) and 0 means L1 */,
  ): Promise<PolygonZKEvmDeposit> {
    const networkConfig = await this.getNetworkConfig();

    const messageBridgeUrl = new URL(networkConfig.bridgeServiceUrl + this.BRIDGES_ENDPOINT);
    messageBridgeUrl.searchParams.set("deposit_cnt", depositCount.toString());
    messageBridgeUrl.searchParams.set("net_id", originNetwork.toString());

    const response = await fetch(messageBridgeUrl);
    const responseJson = await response.json();

    if (responseJson.code && responseJson.message) {
      throw new Error(responseJson.message);
    }

    return responseJson.deposit;
  }

  checkTransactionValidity(transactionReceipt: TransactionReceipt, networkName: string): void {
    if (!transactionReceipt) {
      throw new Error(`Transaction cannot be found on ${networkName}...`);
    }
    if (!transactionReceipt.status) {
      throw new Error(
        `Transaction "${transactionReceipt.transactionHash}" reverted on ${networkName}...`,
      );
    }
  }

  async prepare(): Promise<boolean> {
    return true;
  }

  async relayTxToL1(l2TransactionHash: TransactionHash): Promise<string | undefined> {
    console.log("\nClaiming PolygonZKEVM message on Ethereum L1.");

    const receipt = await this.l2RpcProvider.waitForTransaction(l2TransactionHash, 1, 300000);

    this.checkTransactionValidity(receipt, "Polygon ZKEvm");

    // 1. Extract bridge event parameters required for claiming a message
    const bridgeEventParameters = await parseBridgeEvent(receipt.logs);
    if (!bridgeEventParameters) {
      throw new Error(
        `Cannot find an event ("BridgeEvent") in the L2 transaction ${l2TransactionHash}`,
      );
    }
    console.log("Found BridgeEvent. Proceeding with the next steps...");

    // 2. Fetch message data
    const message = await this.getMessageInfoSafe(
      bridgeEventParameters.depositCount,
      bridgeEventParameters.originNetwork,
    );

    // 3. Check if the message was already claimed on the destination network
    if (message.claim_tx_hash.length) {
      console.log(`Message already relayed to L1 with transaction hash: ${message.claim_tx_hash}`);
      return message.claim_tx_hash;
    }

    // 4. Wait until the message is ready to be claimed
    console.log("Waiting for message to be ready for claiming.");
    let readyForClaim = message.ready_for_claim;
    while (!readyForClaim) {
      const { ready_for_claim } = await this.getMessageInfoSafe(
        bridgeEventParameters.depositCount,
        bridgeEventParameters.originNetwork,
      );

      readyForClaim = ready_for_claim;

      if (readyForClaim) {
        break;
      } else {
        await sleep(5000);
      }
    }
    console.log("Message ready to be claimed.");

    // 5. Fetch merkle proof
    const { proof } = await this.getMessageMerkleProof(
      bridgeEventParameters.depositCount,
      bridgeEventParameters.originNetwork,
    );
    console.log("Found MerkleProof, proceeding with the next steps...");

    // 6. Claim message
    const networkConfig = await this.getNetworkConfig();
    const polygonBridgeContract = PolygonZKEvmBridge__factory.connect(
      networkConfig.l1.PolygonZKEvmBridge,
      this.l1Wallet,
    );

    const L1ClaimTxHash = await polygonBridgeContract.claimMessage(
      proof.merkle_proof,
      bridgeEventParameters.depositCount,
      proof.main_exit_root,
      proof.rollup_exit_root,
      bridgeEventParameters.originNetwork,
      bridgeEventParameters.originAddress,
      bridgeEventParameters.destinationNetwork,
      bridgeEventParameters.destinationAddress,
      bridgeEventParameters.amount,
      bridgeEventParameters.metadata,
    );

    console.log("Claim message transaction sent: ", L1ClaimTxHash.hash);

    await L1ClaimTxHash.wait();
    console.log("Successfully relayed message to L1.\n\n");

    return L1ClaimTxHash.hash;
  }

  async finalize(l1TransactionHash: string): Promise<void> {
    console.log("\nClaiming message travelling to PolygonZKEVM");

    const receipt = await this.l1RpcProvider.waitForTransaction(l1TransactionHash, 1, 300000);

    this.checkTransactionValidity(receipt, "L1");

    // 1. Extract bridge event parameters required for claiming a message
    const bridgeEventParameters = await parseBridgeEvent(receipt.logs);
    if (!bridgeEventParameters) {
      throw new Error(
        `Cannot find an event ("BridgeEvent") in the L1 transaction ${l1TransactionHash}`,
      );
    }
    console.log("Found BridgeEvent. Proceeding with the next steps...");

    // 2. Fetch message data
    const message = await this.getMessageInfoSafe(
      bridgeEventParameters.depositCount,
      bridgeEventParameters.originNetwork,
    );

    // 3. Check if the message was already claimed on the destination network
    if (message.claim_tx_hash.length) {
      console.log(`Message already relayed to L2 with transaction hash: ${message.claim_tx_hash}`);
      return;
    }

    // 4. Wait until the message is ready to be claimed
    console.log("Waiting for message to be ready for claiming.");
    let readyForClaim = message.ready_for_claim;
    while (!readyForClaim) {
      const { ready_for_claim } = await this.getMessageInfoSafe(
        bridgeEventParameters.depositCount,
        bridgeEventParameters.originNetwork,
      );

      readyForClaim = ready_for_claim;

      if (readyForClaim) {
        break;
      } else {
        await sleep(5000);
      }
    }
    console.log("Message ready to be claimed.");

    // 5. Fetch merkle proof
    const { proof } = await this.getMessageMerkleProof(
      bridgeEventParameters.depositCount,
      bridgeEventParameters.originNetwork,
    );
    console.log("Found MerkleProof, proceeding with the next steps...");

    // 6. Claim message
    const networkConfig = await this.getNetworkConfig();
    const polygonBridgeContract = PolygonZKEvmBridge__factory.connect(
      networkConfig.l2.PolygonZKEvmBridge,
      this.l2Wallet,
    );

    const L2ClaimTxHash = await polygonBridgeContract.claimMessage(
      proof.merkle_proof,
      bridgeEventParameters.depositCount,
      proof.main_exit_root,
      proof.rollup_exit_root,
      bridgeEventParameters.originNetwork,
      bridgeEventParameters.originAddress,
      bridgeEventParameters.destinationNetwork,
      bridgeEventParameters.destinationAddress,
      bridgeEventParameters.amount,
      bridgeEventParameters.metadata,
    );

    console.log("Claim message transaction sent: ", L2ClaimTxHash.hash);

    await L2ClaimTxHash.wait();
    console.log("Successfully relayed message to PolygonZKEVM.\n\n");
  }

  addCustomNetwork(filePath: string) {
    const configFileContent = readFileSync(filePath, "utf-8");
    const config: NetworkContracts = JSON.parse(configFileContent);

    this.customNetworkContracts = {
      l1: {
        PolygonZKEvmBridge: config.l1.PolygonZKEvmBridge,
      },
      l2: {
        PolygonZKEvmBridge: config.l2.PolygonZKEvmBridge,
      },
      bridgeServiceUrl: config.bridgeServiceUrl,
    };
  }
}

type MerkleProofResponse = {
  proof: {
    merkle_proof: Array<string>;
    main_exit_root: string;
    rollup_exit_root: string;
  };
};

type NetworkContracts = {
  l1: {
    PolygonZKEvmBridge: string;
  };
  l2: {
    PolygonZKEvmBridge: string;
  };
  bridgeServiceUrl: string;
};

type PolygonZKEvmDeposit = {
  leaf_type: number;
  orig_net: number;
  orig_addr: string;
  amount: string;
  dest_net: number;
  dest_addr: string;
  block_num: string;
  deposit_cnt: string;
  network_id: number;
  tx_hash: string;
  claim_tx_hash: string;
  metadata: string;
  ready_for_claim: boolean;
};
