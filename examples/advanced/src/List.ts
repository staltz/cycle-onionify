import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, span, input, button, ul, VNode, DOMSource} from '@cycle/dom';
import {StateSource, pick, mix} from 'cycle-onionify';
import Item, {State as ItemState, Sources as ItemSources} from './Item';

export type State = Array<ItemState>;

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
  const array$ = sources.onion.state$;

  const childrenSinks$ = array$.map(array =>
    array.map((item, i) => isolate(Item, i)(sources))
  );

  const vdom$ = childrenSinks$
    .compose(pick(sinks => sinks.DOM))
    .compose(mix(xs.combine))
    .map(itemVNodes => ul(itemVNodes));

  const reducer$ = childrenSinks$
    .compose(pick(sinks => sinks.onion))
    .compose(mix(xs.merge));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
