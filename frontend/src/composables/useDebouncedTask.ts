import type { DebouncedFunc } from 'lodash';
import debounce from 'lodash.debounce';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Callable = (...args: any[]) => any;

export function useDebouncedTask(callable: Callable, delay = 0): DebouncedFunc<Callable> {
  return debounce(callable, delay);
}
