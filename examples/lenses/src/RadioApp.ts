import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, VNode, DOMSource} from '@cycle/dom';
import {StateSource, Lens} from 'cycle-onionify';
import Edit, {State as EditState} from './Edit';
import List, {State as ListState} from './List';

export type State = {
  list: ListState;
  currentIndex: number;
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

export default function RadioApp(sources: Sources): Sinks {
  const initReducer$: Stream<Reducer> = xs.of(function initReducer(prev?: State): State {
    const currentIndex = 0;
    return {
      list: ['one', 'two', 'three', 'four'].map((item, i) =>
        ({content: item, selected: i === currentIndex, key: `${i}`})
      ),
      currentIndex,
    };
  });

  const listLens: Lens<State, ListState> = {
    get: state =>
      state.list.map((item, i) => {
        if (item.selected === (i === state.currentIndex)) {
          return item;
        } else {
          return {...item, selected: i === state.currentIndex};
        }
      }),
    set: (state, childState) => {
      const idx = (childState as any).findIndex((item: any, i: number) =>
        item.selected && state.currentIndex !== i
      );
      return {
        currentIndex: idx === -1 ? state.currentIndex : idx,
        list: childState,
      };
    }
  }

  const selectedLens: Lens<State, EditState> = {
    get: state => state.list[state.currentIndex],
    set: (state, childState) => ({
      ...state,
      list: state.list.map((val: any, i: number) =>
        i === state.currentIndex ? {...val, ...childState} : val
      ),
    })
  }

  setTimeout(() => {
    sources.onion.state$.addListener({
      next: s => console.log(s),
    })
  }, 500)

  const listSinks: Sinks = isolate(List, {onion: listLens})(sources);
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
