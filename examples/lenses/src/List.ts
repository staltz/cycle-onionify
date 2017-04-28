import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, VNode, DOMSource} from '@cycle/dom';
import {StateSource, pick, mix, Lens} from 'cycle-onionify';
import Item, {State as ItemState, Sources as ItemSources} from './Item';

export type State = {
  list: Array<{content: string}>;
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

export default function List(sources: Sources): Sinks {
  const itemLens = (index: number): Lens<State, ItemState> => {
    return {
      get: state => ({
        content: state.list[index].content,
        selected: state.currentIndex === index,
      }),
      set: (state, childState) => {
        if (childState.selected && state.currentIndex !== index) {
          return {...state, currentIndex: index};
        }
        return state;
      }
    };
  };

  const state$ = sources.onion.state$;

  const childrenSinks$ = state$.map(state => {
    return state.list.map((item: any, i: number) => {
      return isolate(Item, {onion: itemLens(i)})(sources as any as ItemSources);
    })
  });

  const vdom$ = childrenSinks$
    .compose(pick('DOM'))
    .compose(mix(xs.combine))
    .map(itemVNodes => div({style: {marginTop: '20px'}}, itemVNodes));

  const reducer$ = childrenSinks$
    .compose(pick('onion'))
    .compose(mix(xs.merge));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
