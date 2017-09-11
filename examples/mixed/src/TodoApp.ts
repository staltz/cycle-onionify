import xs, {Stream} from 'xstream';
import isolate from '@cycle/isolate';
import {div, span, ul, input, button, VNode, DOMSource} from '@cycle/dom';
import {StateSource, Lens, makeCollection} from 'cycle-onionify';
import Counter, {State as CounterState} from './Counter';
import Item, {State as ItemState} from './Item';
// import List, {State as ListState} from './List';

export type ItemStateWithKey = ItemState & {key: string};

export type State = {
  list: Array<ItemStateWithKey>;
  counter?: CounterState;
};

export type Reducer = (prev?: State) => State | undefined;

export type Sources = {
  DOM: DOMSource;
  onion: StateSource<State>;
};

export type Sinks = {
  DOM: Stream<VNode>;
  onion: Stream<Reducer>;
};

export type Actions = {
  add$: Stream<string>;
}

function intent(domSource: DOMSource): Actions {
  return {
    add$: domSource.select('.input').events('input')
      .map(inputEv => domSource.select('.add').events('click').mapTo(inputEv))
      .flatten()
      .map(inputEv => (inputEv.target as HTMLInputElement).value),
  };
}

function model(actions: Actions): Stream<Reducer> {
  const initReducer$ = xs.of(function initReducer(prev?: State): State {
    if (prev) {
      return prev;
    } else {
      return {list: []};
    }
  });

  const addReducer$ = actions.add$
    .map(content => function addReducer(prevState: State): State {
      return {
        ...prevState,
        list: prevState.list.concat(
          {
            content: content,
            count: prevState.counter.count,
            key: String(Date.now()),
          }
        ),
      };
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

const List = makeCollection<ItemStateWithKey, any, any>({
  item: Item,
  itemKey: state => state.key,
  itemScope: key => key,
  collectSinks: instances => ({
    DOM: instances.pickCombine('DOM')
      .map(itemVNodes => ul(itemVNodes)),
    onion: instances.pickMerge('onion'),
  })
});

const listLens: Lens<State, Array<ItemStateWithKey>> = {
  get(state: State) {
    return state.list.map((item) => ({...item, count: state.counter.count}))
  },
  set(state: State, listState: Array<ItemStateWithKey>) {
    const count = state.counter ?
      (listState.find(item => item.count !== state.counter.count) || state.counter).count :
      0;
    const newList = listState.map(item => ({...item, count}));
    return {
      counter: {
        count: count
      },
      list: newList,
    };
  },
};

export default function TodoApp(sources: Sources): Sinks {
  const listSinks: Sinks = isolate(List, {onion: listLens})(sources);
  const counterSinks: Sinks = isolate(Counter, {onion: 'counter'})(sources);
  const actions = intent(sources.DOM);
  const parentReducer$ = model(actions);
  const listReducer$ = listSinks.onion;
  const counterReducer$ = counterSinks.onion;
  const reducer$ = xs.merge(
    parentReducer$,
    listReducer$,
    counterReducer$,
  );
  const vdom$ = view(listSinks.DOM, counterSinks.DOM);

  return {
    DOM: vdom$,
    onion: reducer$,
  }
}
