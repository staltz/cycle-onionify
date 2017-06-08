import {Stream} from 'xstream';
import {adapt} from '@cycle/run/lib/adapt';
import {pickMerge} from './pickMerge';
import {pickCombine} from './pickCombine';
import {Instances} from './types';

export class CollectionSource<Si> {
  constructor(private _ins$: Stream<Instances<Si>>) { }

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
    return adapt(this._ins$.compose(pickMerge(selector)));
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
    return adapt(this._ins$.compose(pickCombine(selector)));
  }
}
