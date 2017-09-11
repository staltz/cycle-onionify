import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, VNode, DOMSource} from '@cycle/dom';
import {StateSource, Lens, makeCollection} from 'cycle-onionify';
import Edit, {State as EditState} from './Edit';
import Item, {State as ItemState} from './Item';

export type State = {
  list: Array<ItemState>;
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
        ({content: item, selected: i === currentIndex})
      ),
      currentIndex,
    };
  });

  const listLens: Lens<State, Array<ItemState>> = {
    get: state => state.list,
    set: (state, childState) => {
      const idx = (childState as any).findIndex((item: any, i: number) =>
        item.selected && state.currentIndex !== i
      );
      const newCurrentIndex = idx === -1 ? state.currentIndex : idx;
      const newList = childState.map((item, i) =>
        ({...item, selected: i === newCurrentIndex})
      );
      return {
        currentIndex: newCurrentIndex,
        list: newList,
      };
    }
  }

  const selectedLens: Lens<State, EditState> = {
    get: state => state.list[state.currentIndex],
    set: (state, childState) => ({
      ...state,
      list: state.list.map((item: any, i: number) =>
        i === state.currentIndex ? {...item, ...childState} : item
      ),
    })
  }

  const List = makeCollection({
    item: Item,
    itemKey: (state: any, index: number) => String(index),
    itemScope: (key: string) => key,
    collectSinks: (instances: any) => ({
      DOM: instances.pickCombine('DOM')
        .map((itemVNodes: any) => div({style: {marginTop: '20px'}}, itemVNodes)),
      onion: instances.pickMerge('onion'),
    })
  });

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
