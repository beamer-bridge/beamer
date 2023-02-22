import { Option, program } from "commander";

import { getNetworkId } from "./common/network";
import { SERVICES } from "./map";
import type { ProgramOptions } from "./relayer-program";

export const mainOptions = [
  new Option("--l1-rpc-url <URL>", "RPC Provider URL for layer 1").makeOptionMandatory(),
  new Option(
    "--relay-to-rpc-url <URL>",
    "RPC Provider URL for relay destination rollup",
  ).makeOptionMandatory(),
  new Option(
    "--relay-from-rpc-url <URL>",
    "RPC Provider URL for relay source rollup",
  ).makeOptionMandatory(),
  new Option(
    "--wallet-private-key <hash>",
    "Private key for the layer 1 wallet",
  ).makeOptionMandatory(),
  new Option("--network-from <file_path>", "Path to a file with custom network configuration"),
  new Option("--network-to <file_path>", "Path to a file with custom network configuration"),
];

export async function parseOptions(): Promise<ProgramOptions> {
  const mainProgram = program.createCommand().allowUnknownOption();

  mainOptions.forEach((option) => mainProgram.addOption(option));

  const args: ProgramOptions = mainProgram.parse().opts();

  const networkIdFrom = await getNetworkId(args.relayFromRpcUrl);
  const relayerFrom = SERVICES[networkIdFrom];

  relayerFrom.CLI_OPTIONS.forEach((option) => mainProgram.addOption(option));

  return mainProgram.parse().opts() as ProgramOptions;
}
