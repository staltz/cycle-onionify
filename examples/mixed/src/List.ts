import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, span, input, button, ul, VNode, DOMSource} from '@cycle/dom';
import {StateSource, pick, mix, Lens} from 'cycle-onionify';
import Item, {State as ItemState, Sources as ItemSources} from './Item';
import {State as CounterState} from './Counter';

export type State = {
  list: Array<ItemState>;
  counter: CounterState;
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

export default function List(sources: Sources): Sinks {
  const itemLens = (index: number): Lens<State, ItemState> => {
    return {
      get: state => ({
        content: state.list[index].content,
        count: state.counter.count
      }),
      set: (state, childState) => {
        if (typeof childState === 'undefined') {
          return {
            list: state.list.filter((val: any, i: number) => i !== index),
            counter: state.counter
          }
        } else {
          const newItem = {content: childState.content};
          return {
            list: state.list.map((val: any, i: number) => i === index ? newItem : val),
            counter: {count: childState.count}
          }
        }
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
    .map(itemVNodes => ul(itemVNodes));

  const reducer$ = childrenSinks$
    .compose(pick('onion'))
    .compose(mix(xs.merge));

  return {
    DOM: vdom$,
    onion: reducer$,
  };
}
