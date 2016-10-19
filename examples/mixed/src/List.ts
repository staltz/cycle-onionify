import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, span, input, button, ul, VNode} from '@cycle/dom';
import {DOMSource} from '@cycle/dom/xstream-typings';
import {StateSource, pick, mix} from 'cycle-onionify';
import Item, {State as ItemState, Sources as ItemSources} from './Item';
import {Reducer as CounterReducer} from './Counter';

export type State = Array<ItemState>;

export type Reducer = (prev?: State) => State | undefined;

export interface Sources {
  DOM: DOMSource;
  onion: StateSource<State>;
}

export interface Sinks {
  DOM: Stream<VNode>;
  onion: Stream<Reducer>;
  counterOnion: Stream<CounterReducer>;
}

export default function List(sources: Sources): Sinks {
  const array$ = sources.onion.state$;

  const childrenSinks$ = array$.map(array =>
    array.map((item, i) => isolate(Item, i)(sources as any as ItemSources))
  );

  const vdom$ = childrenSinks$
    .compose(pick('DOM'))
    .compose(mix(xs.combine))
    .map(itemVNodes => ul(itemVNodes));

  const reducer$ = childrenSinks$
    .compose(pick('onion'))
    .compose(mix(xs.merge));

  const counterReducer$ = childrenSinks$
    .compose(pick('counterOnion'))
    .compose(mix(xs.merge));

  return {
    DOM: vdom$,
    onion: reducer$,
    counterOnion: counterReducer$,
  };
}
