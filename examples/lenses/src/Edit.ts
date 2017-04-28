import xs, {Stream} from 'xstream';
import {label, input, VNode, DOMSource} from '@cycle/dom';
import {StateSource} from 'cycle-onionify';

export type State = {
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

export default function Edit(sources: Sources): Sinks {
  const state$ = sources.onion.state$;

  const vdom$ = state$.map(state =>
    label([
      'Edit: ',
      input('.content', {
        attrs: {type: 'text'},
        props: {value: state.content},
      })
    ])
  );

  const editReducer$ = sources.DOM
    .select('.content').events('input')
    .map((ev: Event): Reducer =>
      function editReducer(prevState: State): State {
        return {content: (ev.target as HTMLInputElement).value};
      }
    );

  return {
    DOM: vdom$,
    onion: editReducer$,
  };
}
