import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, span, input, button, ul, VNode, DOMSource} from '@cycle/dom';
import {StateSource, pickCombine, pickMerge} from 'cycle-onionify';
import Item, {State as ItemState, Sources as ItemSources} from './Item';

export type State = Array<ItemState & {key: string}>;

export type Reducer = (prev?: State) => State | undefined;

export type Sources = {
  DOM: DOMSource;
  onion: StateSource<State>;
}

export type Sinks = {
  DOM: Stream<VNode>;
  onion: Stream<Reducer>;
}

export default function List(sources: Sources): Sinks {
  const items = sources.onion.toCollection(Item)
    .uniqueBy(s => s.key)
    .isolateEach(key => key)
    .build(sources);

  const vdom$ = items.pickCombine('DOM')
    .map((itemVNodes: Array<VNode>) => ul(itemVNodes));

  const reducer$ = items.pickMerge('onion');

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
