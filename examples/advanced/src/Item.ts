import xs, {Stream, MemoryStream} from 'xstream';
import {li, span, VNode, DOMSource} from '@cycle/dom';
import {StateSource} from 'cycle-onionify';

export interface State {
  content: string;
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

  const vdom$ = state$.map(state => {
    console.log('Item state update');
    return li('.item', [
      span('.content', `${state.content} `),
      span('.delete', '(delete)'),
      span('.trim', '(trim)')
    ])
  });

  const deleteReducer$ = sources.DOM
  .select('.delete').events('click')
  .mapTo(function removeReducer(prevState: State): State {
    return void 0;
  });

  const trimReducer$ = sources.DOM
  .select('.trim').events('click')
  .mapTo(function trimReducer(prevState: State): State {
    return {
      ...prevState,
      content: prevState.content.slice(0, -1),
    };
  });

  const reducer$ = xs.merge(deleteReducer$, trimReducer$);

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
