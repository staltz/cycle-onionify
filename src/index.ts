import xs, {Stream, MemoryStream} from 'xstream';

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
  } else {
    return array.map((val, i) => i === index ? newVal : val);
  }
}

export class StateSource<T> {
  public state$: MemoryStream<T>;

  constructor(stream: Stream<any>) {
    this.state$ = stream.remember();
  }

  select(scope: string): StateSource<any> {
    return new StateSource(
      this.state$.map(state => state[scope]).filter(s => !!s)
    );
  }

  isolateSource(source: StateSource<any>, scope: string): StateSource<any> {
    return source.select(scope);
  }

  isolateSink(reducer$: Stream<Reducer>, scope: string): Stream<Reducer> {
    return reducer$.map(reducer => function (state: any) {
      const index = parseInt(scope);
      if (Array.isArray(state) && typeof index === 'number') {
        return updateArrayEntry(state, index, reducer);
      } else if (typeof state === 'undefined') {
        return {[scope]: reducer(void 0)};
      } else {
        return Object.assign({}, state, {[scope]: reducer(state[scope])});
      }
    });
  }
}

export default function onionify<So, Si>(main: MainFn<So, Si>, name: string = 'onion'): MainFn<So, Si> {
  return function augmentedMain(sources: So): Si {
    const reducerMimic$ = xs.create<Reducer>();
    const state$ = reducerMimic$
      .fold((state, reducer) => reducer(state), void 0)
      .drop(1);
    sources[name] = new StateSource(state$);
    const sinks = main(sources);
    reducerMimic$.imitate(sinks[name]);
    return sinks;
  }
}
