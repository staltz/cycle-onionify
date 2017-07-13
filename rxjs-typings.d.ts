import {Scope, Reducer, MakeScopesFn} from './lib/types';
import {Observable} from 'rxjs';

export interface StateSource<S> {
  state$: Observable<S>;
  select<R>(scope: Scope<S, R>): StateSource<R>;
  toCollection<T, Si>(this: StateSource<Array<T>>, itemComp: (so: any) => Si): Collection<T, Si>;
  isolateSource<T, R>(source: StateSource<T>, scope: Scope<T, R>): StateSource<R>;
  isolateSink<T, R>(innerReducer$: Observable<Reducer<R>>, scope: Scope<T, R>): Observable<Reducer<T>>;
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
  pickMerge(selector: string): Observable<any>;
  pickCombine(selector: string): Observable<Array<any>>;
}
