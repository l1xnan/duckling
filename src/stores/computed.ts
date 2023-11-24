// refer to:
// 1. https://docs.pmnd.rs/zustand/guides/typescript#middleware-that-changes-the-store-type
// 2. https://github.com/cmlarsen/zustand-middleware-computed-state
// 3. https://github.com/lxw15337674/zustand-middleware-computed/blob/main/src/index.ts
import { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';

export declare type ComputedState<T, S> = (state: T) => S;

type Computed = <
  T,
  S,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  create: StateCreator<T, Mps, Mcs>,
  compute: ComputedState<T, S>,
) => StateCreator<T & S, Mps, Mcs>;

type ComputedImpl = <T, S>(
  create: StateCreator<T, [], []>,
  compute: ComputedState<T, S>,
) => StateCreator<T, [], []>;

const computedImpl: ComputedImpl = (create, compute) => (set, get, api) => {
  type T = ReturnType<typeof create>;
  type S = ReturnType<typeof compute>;
  const setWithComputed: StoreApi<T>['setState'] = (update, replace) => {
    set((state) => {
      const updated =
        typeof update === 'function'
          ? (update as (state: T) => Partial<T> | T)(state)
          : update;
      const computedState = compute({ ...state, ...updated });
      return { ...updated, ...computedState } as T & S;
    }, replace);
  };
  api.setState = setWithComputed;
  const state = create(setWithComputed, get, api);
  return { ...state, ...compute(state) };
};

export const computed = computedImpl as unknown as Computed;
