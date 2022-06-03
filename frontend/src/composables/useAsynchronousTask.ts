import { ref } from 'vue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAsynchronousTask(callable: (...args: any[]) => any) {
  const active = ref(false);
  const error = ref<Error | undefined>(undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function run(...args: any[]) {
    try {
      active.value = true;
      error.value = undefined;
      return await callable(...args);
    } catch (exception: unknown) {
      if (exception instanceof Error) {
        error.value = exception;
      } else {
        error.value = new Error('Unknown Failure!');
        throw exception;
      }
    } finally {
      active.value = false;
    }
  }

  return { active, error, run };
}
