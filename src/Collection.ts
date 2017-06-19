import {Stream} from 'xstream';
import {adapt} from '@cycle/run/lib/adapt';
import isolate from '@cycle/isolate';
import {pickMerge} from './pickMerge';
import {pickCombine} from './pickCombine';
import {Instances, Lens} from './types';

const identityLens = {
  get: <T>(outer: T) => outer,
  set: <T>(outer: T, inner: T) => inner,
};

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

export class Collection<Si> {
  private _instances$: Stream<Instances<Si>>;

  constructor(itemComp: (so: any) => Si,
              sources: any,
              state$: Stream<Array<any> | any>,
              name: string,
              getKey: any) {
    this._instances$ = state$.fold((acc: Instances<Si>, nextState: Array<any> | any) => {
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
  }

  /**
   * Like `merge` in xstream, this operator blends multiple streams together, but
   * picks those streams from a collection of component instances.
   *
   * Use the `selector` string to pick a stream from the sinks object of each
   * component instance, then pickMerge will merge all those picked streams.
   *
   * @param {String} selector a name of a channel in a sinks object belonging to
   * each component in the collection of components.
   * @return {Function} an operator to be used with xstream's `compose` method.
   */
  public pickMerge(selector: string): Stream<any> {
    return adapt(this._instances$.compose(pickMerge(selector)));
  }

  /**
   * Like `combine` in xstream, this operator combines multiple streams together,
   * but picks those streams from a collection of component instances.
   *
   * Use the `selector` string to pick a stream from the sinks object of each
   * component instance, then pickCombine will combine all those picked streams.
   *
   * @param {String} selector a name of a channel in a sinks object belonging to
   * each component in the collection of components.
   * @return {Function} an operator to be used with xstream's `compose` method.
   */
  public pickCombine(selector: string): Stream<Array<any>> {
    return adapt(this._instances$.compose(pickCombine(selector)));
  }
}
