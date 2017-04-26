import xs, {Stream, MemoryStream} from 'xstream';
import {li, span, button, VNode, DOMSource} from '@cycle/dom';
import {StateSource} from 'cycle-onionify';
import {State as CounterState} from './Counter';

export interface State {
  content: string;
  count: number;
}

export type Reducer = (prev?: State) => State | undefined;

export interface Sources {
  DOM: DOMSource;
  onion: StateSource<State>;
}

export interface Sinks {
  DOM: Stream<VNode>;
  onion: Stream<Reducer>;
}

export default function Item(sources: Sources): Sinks {
  const state$ = sources.onion.state$;

  const vdom$ = state$.map(state =>
    li('.item', [
      span('.content', `${state.content} `),
      span('.delete', '(delete)'),
      button('.decrement', 'Decrement'),
      button('.increment', 'Increment'),
      span('.count', `${state.count}`),
    ])
  );

  const removeReducer$ = sources.DOM
    .select('.delete').events('click')
    .mapTo(function removeReducer(prevState: State): State {
      return void 0;
    });

  const counterReducer$ = xs.merge(
    sources.DOM.select('.increment').events('click').mapTo(+1),
    sources.DOM.select('.decrement').events('click').mapTo(-1),
  ).map(delta => function counterReducer(prev: State): State {
    return Object.assign({}, prev, {count: prev.count + delta});
  });

  const reducer$ = xs.merge(removeReducer$, counterReducer$);

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
