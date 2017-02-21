import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, span, input, button, ul, VNode, DOMSource} from '@cycle/dom';
import {StateSource, pick, mix, isolateSink as isolateOnionSink} from 'cycle-onionify';
import Counter, {Sources as CounterSources, State as CounterState} from './Counter';
import List, {Sources as ListSources, State as ListState} from './List';

export interface State {
  list: ListState;
  counter?: CounterState;
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

export interface AddAction {
  type: 'ADD',
  payload: string;
}

export type Action = AddAction;

function intent(domSource: DOMSource): Stream<Action> {
  return domSource.select('.input').events('input')
    .map(inputEv => domSource.select('.add').events('click').mapTo(inputEv))
    .flatten()
    .map(inputEv => {
      return {
        type: 'ADD',
        payload: (inputEv.target as HTMLInputElement).value
      } as AddAction;
    });
}

function model(action$: Stream<Action>): Stream<Reducer> {
  const initReducer$ = xs.of(function initReducer(prev?: State): State {
    if (prev) {
      return prev;
    } else {
      return {list: []};
    }
  });

  const addReducer$ = action$
    .filter(ac => ac.type === 'ADD')
    .map(ac => function addReducer(prevState: State): State {
      return Object.assign({}, prevState, {
        list: prevState.list.concat({content: ac.payload}),
      });
    });

  return xs.merge(initReducer$, addReducer$);
}

function view(listVNode$: Stream<VNode>, counterVNode$: Stream<VNode>): Stream<VNode> {
  return xs.combine(listVNode$, counterVNode$)
    .map(([ulVNode, counterVNode]) =>
      div([
        counterVNode,
        span('New task:'),
        input('.input', {attrs: {type: 'text'}}),
        button('.add', 'Add'),
        ulVNode
      ])
    );
}

export default function TodoApp(sources: Sources): Sinks {
  const listSinks = isolate(List, 'list')(sources as any as ListSources);
  const counterSinks = isolate(Counter, 'counter')(sources as any as CounterSources);
  const action$ = intent(sources.DOM);
  const parentReducer$ = model(action$);
  const listReducer$ = listSinks.onion as any as Stream<Reducer>;
  const counterReducer$ = counterSinks.onion as any as Stream<Reducer>;
  const otherCounterReducer$ = isolateOnionSink(listSinks.counterOnion, 'counter');
  const reducer$ = xs.merge(
    parentReducer$,
    listReducer$,
    counterReducer$,
    otherCounterReducer$,
  );
  const vdom$ = view(listSinks.DOM, counterSinks.DOM);

  return {
    DOM: vdom$,
    onion: reducer$,
  }
}
