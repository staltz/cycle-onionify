import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, span, input, button, ul, VNode, DOMSource} from '@cycle/dom';
import {StateSource, collection, pickMerge, pickCombine, Lens} from 'cycle-onionify';
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
  const items$ = collection(Item, sources);

  const vdom$ = items$
    .compose(pickCombine('DOM'))
    .map(itemVNodes => ul(itemVNodes));

  const reducer$ = items$
    .compose(pickMerge('onion'));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
