import {DevToolEnabledSource} from '@cycle/run';
import xs, {Stream, MemoryStream} from 'xstream';
import dropRepeats from 'xstream/extra/dropRepeats';
import { adapt } from '@cycle/run/lib/adapt';

export type MainFn<So, Si> = (sources: So) => Si;
export type Reducer<T> = (state: T | undefined) => T | undefined;
export type Selector = (sinks: any) => any;
export type Aggregator = (...streams: Array<Stream<any>>) => Stream<any>;
export type Getter<T, R> = (state: T | undefined) => R | undefined;
export type Setter<T, R> = (state: T | undefined, childState: R | undefined) => T | undefined;
export type Lens<T, R> = {
  get: Getter<T, R>;
  set: Setter<T, R>;
}
export type Scope<T, R> = string | number | Lens<T, R>;

export function pick<T>(selector: Selector | string) {
  if (typeof selector === 'string') {
    return function pickWithString(sinksArray$: any): T {
      return adapt((xs.fromObservable(sinksArray$) as Stream<Array<any>>)
        .map(sinksArray => sinksArray.map(sinks => sinks[selector])));
    };
  } else {
    return function pickWithFunction(sinksArray$: any): T {
      return adapt((xs.fromObservable(sinksArray$) as Stream<Array<any>>)
        .map(sinksArray => sinksArray.map(selector)));
    };
  }
}

export function mix<T>(aggregator: Aggregator) {
  return function mixOperator(streamArray$: any): T {
    return adapt((xs.fromObservable(streamArray$) as Stream<Array<Stream<any>>>)
      .map(streamArray => aggregator(...streamArray))
      .flatten());
  }
}

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
  private _name: string | null;

  constructor(stream: Stream<any>, name: string | null) {
    this._name = name;
    this.state$ = adapt(stream.compose(dropRepeats()).remember());
    if (!name) {
      return;
    }
    (this.state$ as MemoryStream<T> & DevToolEnabledSource)._isCycleSource = name;
  }

  public select<R>(scope: Scope<T, R>): StateSource<R> {
    const get = makeGetter(scope);
    return new StateSource<R>(
      this.state$.map(get).filter(s => typeof s !== 'undefined'),
      null,
    );
  }

  public isolateSource = isolateSource;
  public isolateSink = isolateSink;
}

export default function onionify<So, Si>(
                                main: MainFn<So, Si>,
                                name: string = 'onion'): MainFn<Partial<So>, Partial<Si>> {
  return function mainOnionified(sources: Partial<So>): Partial<Si> {
    const reducerMimic$ = xs.create<Reducer<any>>();
    const state$ = reducerMimic$
      .fold((state, reducer) => reducer(state), void 0)
      .drop(1);
    sources[name] = new StateSource<any>(state$, name) as any;
    const sinks = main(sources as So);
    if (sinks[name]) {
      const stream$ = xs.fromObservable<Reducer<any>>(sinks[name]);
      reducerMimic$.imitate(stream$);
    }
    return sinks;
  }
}
