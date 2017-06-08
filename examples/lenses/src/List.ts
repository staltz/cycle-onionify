import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, VNode, DOMSource} from '@cycle/dom';
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
  const itemsSource = sources.onion.asCollection(Item, sources);

  const vdom$ = itemsSource.pickCombine('DOM')
    .map(itemVNodes => div({style: {marginTop: '20px'}}, itemVNodes));

  const reducer$ = itemsSource.pickMerge('onion');

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
