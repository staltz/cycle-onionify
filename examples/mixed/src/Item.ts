import xs, {Stream, MemoryStream} from 'xstream';
import {li, span, button, VNode} from '@cycle/dom';
import {DOMSource} from '@cycle/dom/xstream-typings';
import {StateSource} from 'cycle-onionify';
import {State as CounterState, Reducer as CounterReducer} from './Counter';

export interface State {
  content: string;
}

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

export default function Item(sources: Sources): Sinks {
  const state$ = sources.onion.state$;

  const vdom$ = state$.map(state =>
    li('.item', [
      span('.content', `${state.content} `),
      span('.delete', '(delete)'),
      button('.decrement', 'Decrement'),
      button('.increment', 'Increment')
    ])
  );

  const reducer$ = sources.DOM
    .select('.delete').events('click')
    .mapTo(function removeReducer(prevState: State): State {
      return void 0;
    });

  const counterReducer$ = xs.merge(
    sources.DOM.select('.increment').events('click').mapTo(+1),
    sources.DOM.select('.decrement').events('click').mapTo(-1),
  ).map(delta => function counterReducer(prev: CounterState): CounterState {
    return {count: prev.count + delta};
  });

  return {
    DOM: vdom$,
    onion: reducer$,
    counterOnion: counterReducer$,
  };
}
