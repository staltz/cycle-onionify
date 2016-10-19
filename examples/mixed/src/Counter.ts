import xs, {Stream} from 'xstream';
import {div, button, p, makeDOMDriver, VNode} from '@cycle/dom';
import {DOMSource} from '@cycle/dom/xstream-typings';
import {StateSource} from 'cycle-onionify';

export interface State {
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

export default function Counter(sources: Sources): Sinks {
  const action$ = xs.merge(
    sources.DOM.select('.decrement').events('click').map(ev => -1),
    sources.DOM.select('.increment').events('click').map(ev => +1)
  );

  const state$ = sources.onion.state$;

  const vdom$ = state$.map(state =>
    div([
      button('.decrement', 'Decrement'),
      button('.increment', 'Increment'),
      p('Counter: ' + state.count)
    ])
  );

  const initReducer$ = xs.of(function initReducer(prevState: State): State {
    if (prevState) {
      return prevState;
    } else {
      return {count: 0};
    }
  });
  const updateReducer$ = action$
    .map(num => function updateReducer(prevState: State): State {
      return {count: prevState.count + num};
    });
  const reducer$ = xs.merge(initReducer$, updateReducer$);

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}