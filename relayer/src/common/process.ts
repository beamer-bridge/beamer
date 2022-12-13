import { ppid } from "process";

export async function killOnParentProcessChange(startPpid: number) {
  while (startPpid === ppid) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.log(
    `Relayer parent pid changed, shutting down. Old ppid: ${startPpid}, new ppid: ${ppid}`
  );
  process.exit(1);
}
