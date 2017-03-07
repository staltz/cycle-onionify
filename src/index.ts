import {DevToolEnabledSource} from '@cycle/run';
import xs, {Stream, MemoryStream} from 'xstream';
import dropRepeats from 'xstream/extra/dropRepeats';

export type MainFn<So, Si> = (sources: So) => Si;
export type Reducer<T> = (state: T | undefined) => T | undefined;
export type Selector = (state: any) => any;
export type Aggregator = (...streams: Array<Stream<any>>) => Stream<any>;

export function pick(selector: Selector | string) {
  if (typeof selector === 'string') {
    return function pickWithString(sinksArray$: Stream<Array<any>>): Stream<Array<any>> {
      return sinksArray$.map(sinksArray => sinksArray.map(sinks => sinks[selector]));
    };
  } else {
    return function pickWithFunction(sinksArray$: Stream<Array<any>>): Stream<Array<any>> {
      return sinksArray$.map(sinksArray => sinksArray.map(selector));
    };
  }
}

export function mix(aggregator: Aggregator) {
  return function mixOperator(streamArray$: Stream<Array<Stream<any>>>): Stream<any> {
    return streamArray$
      .map(streamArray => aggregator(...streamArray))
      .flatten();
  }
}

function updateArrayEntry<T>(array: Array<T>, index: number, reducer: Reducer<T>): Array<T> {
  const newVal = reducer(array[index]);
  if (typeof newVal === 'undefined') {
    return array.filter((val, i) => i !== index);
  } else if (newVal === array[index]) {
    return array;
  } else {
    return array.map((val, i) => i === index ? newVal : val);
  }
}

export function isolateSource<T, K extends keyof T>(
                             source: StateSource<T>,
                             scope: K): StateSource<T[K]> {
  return source.select(scope);
}

export function isolateSink<T, K extends keyof T>(
                           innerReducer$: Stream<Reducer<T[K]>>,
                           scope: string): Stream<Reducer<T>> {
  return innerReducer$.map(innerReducer => function (prevOuter: any) {
    const index = parseInt(scope);
    if (Array.isArray(prevOuter) && typeof index === 'number') {
      return updateArrayEntry(prevOuter, index, innerReducer);
    } else if (typeof prevOuter === 'undefined') {
      return {[scope]: innerReducer(void 0)};
    } else {
      const prevInner = prevOuter[scope];
      const nextInner = innerReducer(prevInner);
      if (prevInner === nextInner) {
        return prevOuter;
      } else {
        return {...prevOuter, [scope]: nextInner};
      }
    }
  });
}

export class StateSource<T> {
  public state$: MemoryStream<T>;
  private _name: string | null;

  constructor(stream: Stream<any>, name: string | null) {
    this._name = name;
    this.state$ = stream.compose(dropRepeats()).remember();
    if (!name) {
      return;
    }
    (this.state$ as MemoryStream<T> & DevToolEnabledSource)._isCycleSource = name;
  }

  public select<K extends keyof T>(scope: K): StateSource<T[K]> {
    return new StateSource<T[K]>(
      this.state$.map(s => s[scope]).filter(s => typeof s !== 'undefined'),
      null,
    );
  }

  public isolateSource = isolateSource;
  public isolateSink = isolateSink;
}

export default function onionify<So, Si>(main: MainFn<So, Si>,
                                         name: string = 'onion'): MainFn<Partial<So>, Partial<Si>> {
  return function augmentedMain(sources: Partial<So>): Partial<Si> {
    const reducerMimic$ = xs.create<Reducer<any>>();
    const state$ = reducerMimic$
      .fold((state, reducer) => reducer(state), void 0)
      .drop(1);
    sources[name] = new StateSource<any>(state$, name) as any;
    const sinks = main(sources as So);
    reducerMimic$.imitate(sinks[name]);
    return sinks;
  }
}
