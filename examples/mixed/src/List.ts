import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, span, input, button, ul, VNode, DOMSource} from '@cycle/dom';
import {StateSource, pickMerge, pickCombine, Lens} from 'cycle-onionify';
import Item, {State as ItemState, Sources as ItemSources} from './Item';
import {State as CounterState} from './Counter';

export type State = Array<ItemState & {key: string | number}>;

export type Reducer = (prev?: State) => State | undefined;

export type Sources = {
  DOM: DOMSource;
  onion: StateSource<State>;
};

export type Sinks = {
  DOM: Stream<VNode>;
  onion: Stream<Reducer>;
};

export default function List(sources: Sources): Sinks {
  const itemsSource = sources.onion.toCollection(Item, sources);

  const vdom$ = itemsSource.pickCombine('DOM')
    .map(itemVNodes => ul(itemVNodes));

  const reducer$ = itemsSource.pickMerge('onion');

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
