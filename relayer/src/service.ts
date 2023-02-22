import { ppid } from "process";

import { parseOptions } from "./cli";
import { killOnParentProcessChange } from "./common/process";
import type { ProgramOptions } from "./relayer-program";
import { RelayerProgram } from "./relayer-program";

async function main() {
  const startPpid = ppid;

  const args: ProgramOptions = await parseOptions();
  const relayProgram = await RelayerProgram.createFromArgs(args);

  try {
    if (args.networkFrom) {
      relayProgram.l2RelayerFrom.addCustomNetwork(args.networkFrom);
    }
    if (args.networkTo) {
      relayProgram.l2RelayerTo.addCustomNetwork(args.networkTo);
    }

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
