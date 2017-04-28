import xs, {Stream} from 'xstream';
import {div, button, VNode, DOMSource} from '@cycle/dom';
import {StateSource} from 'cycle-onionify';

export type State = {
  content: string;
  selected: boolean;
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
    const style = {width: '120px', height: '20px', backgroundColor: state.selected ? 'yellow' : ''};
    return div(
      button('.item', {style}, state.content)
    );
  });

  const selectReducer$ = sources.DOM
    .select('.item').events('click')
    .mapTo(function selectReducer(prevState: State): State {
      return {...prevState, selected: true};
    });

  return {
    DOM: vdom$,
    onion: selectReducer$,
  };
}
