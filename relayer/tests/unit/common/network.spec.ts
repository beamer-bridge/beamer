import type { Network } from "@ethersproject/providers";
import { JsonRpcProvider } from "@ethersproject/providers";

import { getNetworkId } from "@/common/network";

describe("getNetworkId", () => {
  it("returns the network id", async () => {
    const chainId = 99999;
    const network: Network = { chainId, name: "testchain" };
    jest.spyOn(JsonRpcProvider.prototype, "getNetwork").mockResolvedValue(network);

    const returnedChainId = await getNetworkId("http://rpc.test");

    expect(returnedChainId).toBe(chainId);
  });
});
