import { Command } from "commander";

const program = new Command();

program
  .name("cross-chain-messaging")
  .version("0.1.0")
  .command("relay", "Relay a message between rollups", {
    executableFile: "./cli/commands/relay.ts",
  })
  .command("prove-op-message", "Prove an OP message on L1", {
    executableFile: "./cli/commands/prove-op-message.ts",
  });

program.parse(process.argv);

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
