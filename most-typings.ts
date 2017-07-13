import {Scope, Reducer, MakeScopesFn} from './lib/types';
import {Stream} from 'most';

export interface StateSource<S> {
  state$: Stream<S>;
  select<R>(scope: Scope<S, R>): StateSource<R>;
  toCollection<T, Si>(this: StateSource<Array<T>>, itemComp: (so: any) => Si): Collection<T, Si>;
  isolateSource<T, R>(source: StateSource<T>, scope: Scope<T, R>): StateSource<R>;
  isolateSink<T, R>(innerReducer$: Stream<Reducer<R>>, scope: Scope<T, R>): Stream<Reducer<T>>;
}

export interface Collection<S, Si> {
  uniqueBy(getKey: (state: S) => string): UniqueCollection<S, Si>;
  isolateEach(makeScopes: MakeScopesFn): Collection<S, Si>;
  build(sources: any): Instances<Si>;
}

export interface UniqueCollection<S, Si> extends Collection<S, Si> {
  isolateEach(makeScopes: (key: string) => string | object): UniqueCollection<S, Si>;
}

export interface Instances<Si> {
  pickMerge(selector: string): Stream<any>;
  pickCombine(selector: string): Stream<Array<any>>;
}
