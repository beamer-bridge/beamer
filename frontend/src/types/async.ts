export type Cancelable<T> = {
  promise: Promise<T>;
  cancel: () => void;
};
