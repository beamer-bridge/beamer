import type { Ref } from 'vue';
import { ref } from 'vue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CreateAsyncProcessReturn<T extends (...args: any[]) => any> {
  active: Ref<boolean>;
  run: (...args: Parameters<T>) => Promise<ReturnType<T>>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function createAsyncProcess<T extends (...args: any[]) => any>(
  fn: T,
): CreateAsyncProcessReturn<T> {
  const active: CreateAsyncProcessReturn<T>['active'] = ref(false);

  const run: CreateAsyncProcessReturn<T>['run'] = async (...args) => {
    try {
      active.value = true;
      const result = await fn(...args);
      active.value = false;
      return result;
    } catch (error) {
      active.value = false;
      throw error;
    }
  };

  return { active, run };
}
