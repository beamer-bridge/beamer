import { Command } from "commander";
import { ppid } from "process";

import { killOnParentProcessChange } from "../../common/process";
import type { ProgramOptions } from "../programs/prove-op-message";
import { OPMessageProverProgram, validateArgs } from "../programs/prove-op-message";

const program = new Command();

program
  .requiredOption("--l1-rpc-url <URL>", "RPC Provider URL for layer 1")
  .requiredOption("--l2-rpc-url <URL>", "RPC Provider URL for relay source rollup")
  .requiredOption("--wallet-private-key <hash>", "Private key for the layer 1 wallet")
  .requiredOption(
    "--l2-transaction-hash <hash>",
    "Layer 2 transaction hash that needs to be proved",
  )
  .option("--custom-network <file_path>", "Path to a file with custom network configuration");

program.parse(process.argv);

const args: ProgramOptions = program.opts();
const argValidationErrors = validateArgs(args);

if (argValidationErrors.length) {
  console.error(argValidationErrors.join("\n"));
  process.exit(1);
}

async function main() {
  const startPpid = ppid;

  const relayProgram = await OPMessageProverProgram.createFromArgs(args);

  try {
    await Promise.race([relayProgram.run(), killOnParentProcessChange(startPpid)]);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
