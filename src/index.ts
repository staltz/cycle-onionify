import {DevToolEnabledSource} from '@cycle/run';
import xs, {Stream, MemoryStream, InternalListener, OutSender, Operator} from 'xstream';
import dropRepeats from 'xstream/extra/dropRepeats';
import isolate from '@cycle/isolate';
import {adapt} from '@cycle/run/lib/adapt';
export {pickCombine} from './pickCombine';
export {pickMerge} from './pickMerge';
import {pickMerge} from './pickMerge';

export type MainFn<So, Si> = (sources: So) => Si;
export type Reducer<T> = (state: T | undefined) => T | undefined;
export type Getter<T, R> = (state: T | undefined) => R | undefined;
export type Setter<T, R> = (state: T | undefined, childState: R | undefined) => T | undefined;
export type Lens<T, R> = {
  get: Getter<T, R>;
  set: Setter<T, R>;
};
export type Scope<T, R> = string | number | Lens<T, R>;
export type Instances<Si> = {
  dict: Map<string, Si>,
  arr: Array<Si & {_key: string}>,
};

function defaultGetKey(statePiece: any) {
  return statePiece.key;
}

function instanceLens(getKey: any, key: string): Lens<Array<any>, any> {
  return {
    get(arr: Array<any> | undefined): any {
      if (typeof arr === 'undefined') {
        return void 0;
      } else {
        for (let i = 0, n = arr.length; i < n; ++i) {
          if (getKey(arr[i]) === key) {
            return arr[i];
          }
        }
        return void 0;
      }
    },

    set(arr: Array<any> | undefined, item: any): any {
      if (typeof arr === 'undefined') {
        return [item];
      } else if (typeof item === 'undefined') {
        return arr.filter(s => getKey(s) !== key);
      } else {
        return arr.map(s => {
          if (getKey(s) === key) {
            return item;
          } else {
            return s;
          }
        });
      }
    },
  };
}

const identityLens = {
  get: <T>(outer: T) => outer,
  set: <T>(outer: T, inner: T) => inner,
};

function makeGetter<T, R>(scope: Scope<T, R>): Getter<T, R> {
  if (typeof scope === 'string' || typeof scope === 'number') {
    return function lensGet(state) {
      if (typeof state === 'undefined') {
        return void 0;
      } else {
        return state[scope];
      }
    };
  } else {
    return scope.get;
  }
}

function makeSetter<T, R>(scope: Scope<T, R>): Setter<T, R> {
  if (typeof scope === 'string' || typeof scope === 'number') {
    return function lensSet(state: T, childState: R): T {
      if (Array.isArray(state)) {
        return updateArrayEntry(state, scope, childState) as any;
      } else if (typeof state === 'undefined') {
        return {[scope]: childState} as any as T;
      } else {
        return {...(state as any), [scope]: childState};
      }
    };
  } else {
    return scope.set;
  }
}

function updateArrayEntry<T>(array: Array<T>, scope: number | string, newVal: any): Array<T> {
  if (newVal === array[scope]) {
    return array;
  }
  const index = parseInt(scope as string);
  if (typeof newVal === 'undefined') {
    return array.filter((val, i) => i !== index);
  }
  return array.map((val, i) => i === index ? newVal : val);
}

export function isolateSource<T, R>(
                             source: StateSource<T>,
                             scope: Scope<T, R>): StateSource<R> {
  return source.select(scope);
}

export function isolateSink<T, R>(
                           innerReducer$: Stream<Reducer<R>>,
                           scope: Scope<T, R>): Stream<Reducer<T>> {
  const get = makeGetter(scope);
  const set = makeSetter(scope);

  return innerReducer$
    .map(innerReducer => function outerReducer(outer: T | undefined) {
      const prevInner = get(outer);
      const nextInner = innerReducer(prevInner);
      if (prevInner === nextInner) {
        return outer;
      } else {
        return set(outer, nextInner);
      }
    });
}

export class StateSource<T> {
  public state$: MemoryStream<T>;
  private _state$: MemoryStream<T>;
  private _name: string;

  constructor(stream: Stream<any>, name: string) {
    this._state$ = stream
      .filter(s => typeof s !== 'undefined')
      .compose(dropRepeats())
      .remember();
    this._name = name;
    this.state$ = adapt(this._state$);
    (this._state$ as MemoryStream<T> & DevToolEnabledSource)._isCycleSource = name;
  }

  /**
   * Selects a part (or scope) of the state object and returns a new StateSource
   * dynamically representing that selected part of the state.
   *
   * @param {string|number|lens} scope as a string, this argument represents the
   * property you want to select from the state object. As a number, this
   * represents the array index you want to select from the state array. As a
   * lens object (an object with get() and set()), this argument represents any
   * custom way of selecting something from the state object.
   */
  public select<R>(scope: Scope<T, R>): StateSource<R> {
    const get = makeGetter(scope);
    return new StateSource<R>(this._state$.map(get), this._name);
  }

  /**
   * Builds a collection of many child components that follow the dynamic shape
   * of this StateSource.
   *
   * Typically you use this function when the state$ emits an arrays, and each
   * entry in the array is an object holding the state for each child component.
   * When the state array grows, the collection will automatically instantiate
   * a new child component. Similarly, when the state array gets smaller, the
   * collection will handle removal of the child component instances.
   *
   * This function returns a stream of "instances", which are a lower-level
   * data structure that should only be consumed with `pickCombine` and
   * `pickMerge`.
   *
   * As arguments, you pass the child Cycle.js component function to use for
   * each entry in the array, and the sources object to give to as input to each
   * child component. Each entry in the array is expected to be an object with
   * at least `key` as a property, which should uniquely identify that child. If
   * these objects have a different unique identifier like `id`, you can tell
   * that to `asCollection` in the third argument: a function that takes the
   * child object state, and returns the unique identifier. By default, this
   * third argument is the function `obj => obj.key`.
   *
   * @param {Function} itemComp a function that takes `sources` as input and
   * returns `sinks`, representing the component to be used for each child in
   * the collection.
   * @param {Object} sources the object with sources to pass as input for each
   * child component.
   * @param getKey
   */
  public asCollection<Si>(itemComp: (so: any) => Si,
                          sources: any,
                          getKey: any = defaultGetKey): CollectionSource<Si> {
    const array$ = this._state$;
    const name = this._name;

    const collection$ = array$.fold((acc: Instances<Si>, nextState: Array<any> | any) => {
      const dict = acc.dict;
      if (Array.isArray(nextState)) {
        const nextInstArray = Array(nextState.length) as Array<Si & {_key: string}>;
        const nextKeys = new Set<string>();
        // add
        for (let i = 0, n = nextState.length; i < n; ++i) {
          const key = getKey(nextState[i]);
          nextKeys.add(key);
          if (dict.has(key)) {
            nextInstArray[i] = dict.get(key) as any;
          } else {
            const scopes = {'*': '$' + key, [name]: instanceLens(getKey, key)};
            const sinks = isolate(itemComp, scopes)(sources);
            dict.set(key, sinks);
            nextInstArray[i] = sinks;
          }
          nextInstArray[i]._key = key;
        }
        // remove
        dict.forEach((_, key) => {
          if (!nextKeys.has(key)) {
            dict.delete(key);
          }
        });
        nextKeys.clear();
        return {dict: dict, arr: nextInstArray};
      } else {
        dict.clear();
        const key = getKey(nextState);
        const scopes = {'*': '$' + key, [name]: identityLens};
        const sinks = isolate(itemComp, scopes)(sources);
        dict.set(key, sinks);
        return {dict: dict, arr: [sinks]}
      }
    }, {dict: new Map(), arr: []} as Instances<Si>);

    return new CollectionSource<Si>(collection$, Object.keys(sources));
  }

  public isolateSource = isolateSource;
  public isolateSink = isolateSink;
}

export type Transformer<Si> = (name: string) => (s: Stream<Instances<Si>>) => Stream<any>;
export type ToSinksConfig<Si> = { '*': Transformer<Si> } & TransformerConfig<Si> | { '*': Transformer<Si> }; //Don't know why this | is needed
export type TransformerConfig<Si> = { [k in keyof Si]?: Transformer<Si> };

export class CollectionSource<Si> {
  constructor(private _ins$: Stream<Instances<Si>>, private _srcs: string[]) { }

  public toSinks<T>(config: ToSinksConfig<Si> = { '*':  pickMerge }) : Si {
    return this._srcs
      .map(n => ({ [n]: this._ins$.compose((config[n] || config['*'])(n)) }))
      .reduce(Object.assign, {});
  }
}

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

/**
 * Given a Cycle.js component that expects an onion state *source* and will
 * output onion reducer *sink*, this function sets up the state management
 * mechanics to accumulate state over time and provide the state source. It
 * returns a Cycle.js component which wraps the component given as input.
 * Essentially, it hooks up the onion sink with the onion source as a cycle.
 *
 * Optionally, you can pass a custom name for the onion channel. By default,
 * the name is 'onion' in sources and sinks, but you can change that to be
 * whatever string you wish.
 *
 * @param {Function} main a function that takes `sources` as input and outputs
 * `sinks`.
 * @param {String} name an optional string for the custom name given to the
 * onion channel. By default, it is 'onion'.
 * @return {Function} a component that wraps the main function given as input,
 * adding state accumulation logic to it.
 */
export default function onionify<T, So extends OSo<T>, Si extends OSi<T>>(
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
      const stream$ = xs.fromObservable<Reducer<T>>(sinks[name]);
      reducerMimic$.imitate(stream$);
    }
    return sinks;
  };
}
