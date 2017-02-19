import {DevToolEnabledSource} from '@cycle/base';
import xs, {Stream, MemoryStream} from 'xstream';
import dropRepeats from 'xstream/extra/dropRepeats';

export type MainFn<Sources, Sinks> = (sources: Sources) => Sinks;
export type Reducer = (state: any) => any;
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

function updateArrayEntry<T>(array: Array<T>, index: number, reducer: Reducer): Array<T> {
  const newVal = reducer(array[index]);
  if (typeof newVal === 'undefined') {
    return array.filter((val, i) => i !== index);
  } else if (newVal === array[index]) {
    return array;
  } else {
    return array.map((val, i) => i === index ? newVal : val);
  }
}

export function isolateSource(source: StateSource<any>, scope: string): StateSource<any> {
  return source.select(scope);
}

export function isolateSink(reducer$: Stream<Reducer>, scope: string): Stream<Reducer> {
  return reducer$.map(reducer => function (state: any) {
    const index = parseInt(scope);
    if (Array.isArray(state) && typeof index === 'number') {
      return updateArrayEntry(state, index, reducer);
    } else if (typeof state === 'undefined') {
      return {[scope]: reducer(void 0)};
    } else {
      const prevPiece = state[scope];
      const nextPiece = reducer(prevPiece);
      if (prevPiece === nextPiece) {
        return state;
      } else {
        return Object.assign({}, state, {[scope]: nextPiece});
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

  public select(scope: string): StateSource<any> {
    return new StateSource(
      this.state$.map(s => s[scope]).filter(s => typeof s !== 'undefined'),
      null,
    );
  }

  public isolateSource: (source: StateSource<any>, scope: string) => StateSource<any> = isolateSource;
  public isolateSink: (reducer$: Stream<Reducer>, scope: string) => Stream<Reducer> = isolateSink;
}

export default function onionify<So, Si>(main: MainFn<So, Si>,
                                         name: string = 'onion'): MainFn<So, Si> {
  return function augmentedMain(sources: So): Si {
    const reducerMimic$ = xs.create<Reducer>();
    const state$ = reducerMimic$
      .fold((state, reducer) => reducer(state), void 0)
      .drop(1);
    sources[name] = new StateSource(state$, name);
    const sinks = main(sources);
    reducerMimic$.imitate(sinks[name]);
    return sinks;
  }
}
