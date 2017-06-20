import xs, {Stream, MemoryStream} from 'xstream';
import dropRepeats from 'xstream/extra/dropRepeats';
import {DevToolEnabledSource} from '@cycle/run';
import {adapt} from '@cycle/run/lib/adapt';
import {Collection} from './Collection';
import {Getter, Setter, Lens, Scope, Reducer} from './types';

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

export class StateSource<S> {
  public state$: MemoryStream<S>;
  private _state$: MemoryStream<S>;
  private _name: string;

  constructor(stream: Stream<any>, name: string) {
    this._state$ = stream
      .filter(s => typeof s !== 'undefined')
      .compose(dropRepeats())
      .remember();
    this._name = name;
    this.state$ = adapt(this._state$);
    (this._state$ as MemoryStream<S> & DevToolEnabledSource)._isCycleSource = name;
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
  public select<R>(scope: Scope<S, R>): StateSource<R> {
    const get = makeGetter(scope);
    return new StateSource<R>(this._state$.map(get), this._name);
  }

  /**
   * Treats the state in this StateSource as a dynamic collection of many child
   * components, returning a Collection object.
   *
   * Typically you use this function when the state$ emits arrays, and each
   * entry in the array is an object holding the state for each child component.
   * When the state array grows, the collection will automatically instantiate
   * a new child component. Similarly, when the state array gets smaller, the
   * collection will handle removal of the corresponding child component.
   *
   * This function returns a Collection, which can be consumed with the
   * operators `pickCombine` and `pickMerge` attached to it as methods.
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
   * @return {Collection}
   */
  public toCollection<T, Si>(this: StateSource<Array<T>>,
                             itemComp: (so: any) => Si): Collection<T, Si> {
    return new Collection<T, Si>(itemComp, this._state$ as any, this._name);
  }

  public isolateSource = isolateSource;
  public isolateSink = isolateSink;
}
