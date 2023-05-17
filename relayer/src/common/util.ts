export const isUndefined = (property: unknown): boolean => {
  return typeof property === "undefined";
};

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
