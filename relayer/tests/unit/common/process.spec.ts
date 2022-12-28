import { killOnParentProcessChange } from "@/common/process";

describe("killOnParentProcessChange", () => {
  jest.useFakeTimers();
  const startPpid = 123;

  let ppid: number;
  beforeEach(() => {
    console.log = jest.fn();
    ppid = process.ppid;
    Object.defineProperty(process, "ppid", { value: startPpid });
  });
  afterEach(() => {
    Object.defineProperty(process, "ppid", { value: ppid });
  });

  it("calls exit when pid changes", async () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation();

    killOnParentProcessChange(startPpid);
    Object.defineProperty(process, "ppid", { value: startPpid + 1 });
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("never exits when pid does not change", async () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation();

    killOnParentProcessChange(startPpid);
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(exitSpy).toHaveBeenCalledTimes(0);
  });
});
