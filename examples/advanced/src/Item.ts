import xs, {Stream, MemoryStream} from 'xstream';
import {li, span, VNode, DOMSource} from '@cycle/dom';
import {StateSource} from 'cycle-onionify';

export interface State {
  content: string;
  key: number;
}

export type Reducer = (prev?: State) => State | undefined;

export type Sources = {
  DOM: DOMSource;
  onion: StateSource<State>;
}

export type Sinks = {
  DOM: Stream<VNode>;
  onion: Stream<Reducer>;
}

export default function Item(sources: Sources): Sinks {
  const state$ = sources.onion.state$;

  const vdom$ = state$.map(state =>
    li('.item', [
      span('.content', `${state.content} `),
      span('.delete', '(delete)')
    ])
  );

  const reducer$ = sources.DOM
    .select('.delete').events('click')
    .mapTo(function removeReducer(prevState: State): State {
      return void 0;
    });

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
