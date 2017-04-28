import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, VNode, DOMSource} from '@cycle/dom';
import {StateSource, pick, mix, Lens} from 'cycle-onionify';
import Edit, {State as EditState} from './Edit';
import List, {State} from './List';

export type Reducer = (prev?: State) => State | undefined;

export type Sources = {
  DOM: DOMSource;
  onion: StateSource<State>;
}

export type Sinks = {
  DOM: Stream<VNode>;
  onion: Stream<Reducer>;
}

export default function RadioApp(sources: Sources): Sinks {
  const initReducer$: Stream<Reducer> = xs.of(function initReducer(prev?: State): State {
    return {
      list: [{content: 'one'}, {content: 'two'}, {content: 'three'}, {content: 'four'}],
      currentIndex: 0,
    };
  });

  const identityLens: Lens<State, State> = {
    get: state => state,
    set: (state, childState) => childState
  };

  const selectedLens: Lens<State, EditState> = {
    get: state => state.list[state.currentIndex],
    set: (state, childState) => ({
      ...state,
      list: state.list.map((val: any, i: number) => i === state.currentIndex ? childState : val)
    })
  }

  const listSinks: Sinks = isolate(List, {onion: identityLens})(sources);
  const listVDom = listSinks.DOM;
  const listReducer$ = listSinks.onion;

  const editSinks: Sinks = isolate(Edit, {onion: selectedLens})(sources);
  const editVDom = editSinks.DOM;
  const editReducer$ = editSinks.onion;

  const vdom$ = xs.combine(listVDom, editVDom)
    .map(([listVNode, editVNode]) =>
      div([
        editVNode,
        listVNode
      ])
    );

  const reducer$ = xs.merge(initReducer$, listReducer$, editReducer$);

  return {
    DOM: vdom$,
    onion: reducer$,
  }
}
