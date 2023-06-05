import type { OPMessageProverProgram } from "./programs/prove-op-message";
import type { RelayerProgram } from "./programs/relay";

export type ExtendedProgram = OPMessageProverProgram | RelayerProgram;
