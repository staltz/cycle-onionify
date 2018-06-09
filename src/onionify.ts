import xs, {Stream} from 'xstream';
import concat from 'xstream/extra/concat';
import {MainFn, Reducer} from './types';
import {StateSource} from './StateSource';
import microtask from 'quicktask';

const schedule = microtask();

/**
 * While we are waiting for keyof subtraction to land in TypeScript,
 * https://github.com/Microsoft/TypeScript/issues/12215,
 * we must use `any` as the type of sources or sinks in the mainOnionified.
 * This is because the correct type is *not*
 *
 * Main<So, Si>
 *
 * *neither*
 *
 * Main<Partial<So>, Partial<Si>>
 *
 * The former will signal to Cycle.run that a driver for 'onion' is needed,
 * while the latter will make valid channels like 'DOM' become optional.
 * The correct type should be
 *
 * Main<Omit<So, 'onion'>, Omit<Si, 'onion'>>
 */
export type Omit<T, K extends keyof T> = any;
// type Omit<T, K extends keyof T> = {
//     [P in keyof T - K]: T[P];
// };

export type OSo<T> = {onion: StateSource<T>};
export type OSi<T> = {onion: Stream<Reducer<T>>};

export type MainOnionified<T, So extends OSo<T>, Si extends OSi<T>> =
  MainFn<Omit<So, 'onion'>, Omit<Si, 'onion'>>;

export function onionify<T, So extends OSo<T>, Si extends OSi<T>>(
                                main: MainFn<So, Si>,
                                name: string = 'onion'): MainOnionified<T, So, Si> {
  return function mainOnionified(sources: Omit<So, 'onion'>): Omit<Si, 'onion'> {
    const reducerMimic$ = xs.create<Reducer<T>>();
    const state$ = reducerMimic$
      .fold((state, reducer) => reducer(state), void 0 as (T | undefined))
      .drop(1);
    sources[name] = new StateSource<any>(state$, name);
    const sinks = main(sources as So);
    if (sinks[name]) {
      const stream$ = concat(
        xs.fromObservable<Reducer<T>>(sinks[name]),
        xs.never(),
      );
      stream$.subscribe({
        next: i => schedule(() => reducerMimic$._n(i)),
        error: err => schedule(() => reducerMimic$._e(err)),
        complete: () => schedule(() => reducerMimic$._c()),
      })
    }
    return sinks;
  };
}
