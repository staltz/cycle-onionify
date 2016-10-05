import xs, {Stream, MemoryStream} from 'xstream';

const hasOwnProperty = Object.prototype.hasOwnProperty;
function objectExtend<T>(oldObj: T, newObj: T): T {
  var target = {};
  for (var key in oldObj) {
    if (hasOwnProperty.call(oldObj, key)) {
      target[key] = oldObj[key];
    }
  }
  for (var key in newObj) {
    if (hasOwnProperty.call(newObj, key)) {
      target[key] = newObj[key];
    }
  }
  return <T> target;
}

export type MainFn<Sources, Sinks> = (sources: Sources) => Sinks;
export type Reducer = (state: any) => any;

export default function onionify<So, Si>(main: MainFn<So, Si>, name: string = 'onion'): MainFn<So, Si> {
  return function augmentedMain(sources: So): Si {
    const reducerMimic$ = xs.create<Reducer>();
    const state$ = reducerMimic$
      .fold((state, reducer) => reducer(state), {})
      .drop(1);
    sources[name] = new StateSource(state$);
    const sinks = main(sources);
    reducerMimic$.imitate(sinks[name]);
    return sinks;
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
      } else {
        return objectExtend(state, {[scope]: reducer(state[scope])});
      }
    });
  }
}
