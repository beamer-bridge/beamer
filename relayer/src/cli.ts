import { Command } from "commander";
import { ppid } from "process";

import type { ProgramOptions as OPMessageProverProgramOptions } from "./cli/programs/prove-op-message";
import { OPMessageProverProgram } from "./cli/programs/prove-op-message";
import type { ProgramOptions as RelayProgramOptions } from "./cli/programs/relay";
import { RelayerProgram } from "./cli/programs/relay";
import type { ExtendedProgram } from "./cli/types";
import { killOnParentProcessChange } from "./common/process";

const program = new Command();

program
  .name("beamer-relayer")
  .description(
    "Beamer Relayer provides utilities for facilitating cross-chain messaging for the Beamer Protocol.",
  );

/** `relay` subcommand */
program
  .command("relay")
  .description("Relay a message between rollups.")
  .requiredOption("--l1-rpc-url <URL>", "RPC Provider URL for layer 1")
  .requiredOption("--l2-relay-to-rpc-url <URL>", "RPC Provider URL for relay destination rollup")
  .requiredOption("--l2-relay-from-rpc-url <URL>", "RPC Provider URL for relay source rollup")
  .requiredOption("--keystore-file <file_path>", "Keystore file for the layer 1 wallet")
  .requiredOption("--password <str>", "Password of keystore file for the layer 1 wallet")
  .requiredOption(
    "--l2-transaction-hash <hash>",
    "Layer 2 transaction hash that needs to be relayed",
  )
  .option("--network-from <file_path>", "Path to a file with custom network configuration")
  .option("--network-to <file_path>", "Path to a file with custom network configuration")
  .action(async (options: RelayProgramOptions) => {
    const argValidationErrors = RelayerProgram.validateArgs(options);
    if (argValidationErrors.length) {
      throw new Error(argValidationErrors.join("\n"));
    }

    const program = await RelayerProgram.createFromArgs(options);
    runProgram(program);
  });

/** `prove-op-message` subcommand */
program
  .command("prove-op-message")
  .description("Prove an OP message on L1")
  .requiredOption("--l1-rpc-url <URL>", "RPC Provider URL for layer 1")
  .requiredOption("--l2-rpc-url <URL>", "RPC Provider URL for relay source rollup")
  .requiredOption("--keystore-file <file_path>", "Keystore file for the layer 1 wallet")
  .requiredOption("--password <str>", "Password of keystore file for the layer 1 wallet")
  .requiredOption(
    "--l2-transaction-hash <hash>",
    "Layer 2 transaction hash that needs to be proved",
  )
  .option("--custom-network <file_path>", "Path to a file with custom network configuration")
  .action(async (options: OPMessageProverProgramOptions) => {
    const argValidationErrors = OPMessageProverProgram.validateArgs(options);
    if (argValidationErrors.length) {
      throw new Error(argValidationErrors.join("\n"));
    }

    const program = await OPMessageProverProgram.createFromArgs(options);
    runProgram(program);
  });

async function runProgram(program: ExtendedProgram) {
  const startPpid = ppid;
  try {
    await Promise.race([program.run(), killOnParentProcessChange(startPpid)]);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

process
  .on("unhandledRejection", (reason) => {
    console.error(new Date().toUTCString() + " Unhandled Rejection:", reason);
    process.exit(1);
  })
  .on("uncaughtException", (error) => {
    console.error(new Date().toUTCString() + " Uncaught Exception:", error.message);
    console.error(error.stack);
    process.exit(1);
  });

program.parse(process.argv);
