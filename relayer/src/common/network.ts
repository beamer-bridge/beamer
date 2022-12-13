import { JsonRpcProvider } from "@ethersproject/providers";

export async function getNetworkId(rpcUrl: string): Promise<number> {
  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  return network.chainId;
}
