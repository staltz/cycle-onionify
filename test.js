import test from 'ava';
import xs from 'xstream';
import delay from 'xstream/extra/delay';
import isolate from '@cycle/isolate';
import onionify, {
  pickCombine,
  pickMerge,
  isolateSource,
  isolateSink,
} from './lib/index';

test('returns a wrapped main function', t => {
  function main() { return {}; }

  const wrapped = onionify(main);
  t.is(typeof wrapped, 'function');

  t.pass();
});

test('inner function receives StateSource under sources.onion', t => {
  t.plan(6);
  function main(sources) {
    t.truthy(sources.onion);
    t.is(typeof sources.onion, 'object');
    t.is(typeof sources.onion.state$, 'object');
    t.is(typeof sources.onion.select, 'function');
    t.is(typeof sources.onion.isolateSource, 'function');
    t.is(typeof sources.onion.isolateSink, 'function');
    return {};
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('inner function receives StateSource under sources.whatever', t => {
  t.plan(6);
  function main(sources) {
    t.truthy(sources.whatever);
    t.is(typeof sources.whatever, 'object');
    t.is(typeof sources.whatever.state$, 'object');
    t.is(typeof sources.whatever.select, 'function');
    t.is(typeof sources.whatever.isolateSource, 'function');
    t.is(typeof sources.whatever.isolateSink, 'function');
    return {};
  }

  const wrapped = onionify(main, 'whatever');
  wrapped({});
});

test('inner function takes StateSource, sends reducers to sink', t => {
  t.plan(3);

  function main(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    sources.onion.state$.addListener({
      next(x) { t.is(x.foo, 'bar'); },
      error(e) { t.fail(e); },
      complete() {},
    });

    return {
      onion: xs.of(function reducer1(prevState) {
        return {foo: 'bar'};
      }),
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('StateSource.state$ never emits if no sink reducer was emitted', t => {
  t.plan(2);

  function main(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    sources.onion.state$.addListener({
      next(x) { t.fail('StateSource should not emit in this case'); },
      error(e) { t.fail(e); },
      complete() { t.fail('StateSource should not complete'); },
    });

    return {
      onion: xs.never(),
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('reducers receive previous state', t => {
  t.plan(7);

  function main(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);

    const expected = [7, 10, 15, 25];
    sources.onion.state$.addListener({
      next(x) { t.is(x.count, expected.shift()); },
      error(e) { t.fail(e); },
      complete() { t.is(expected.length, 0); },
    });

    const reducer$ = xs.of(
      () => ({count: 7}),
      prevState => ({count: prevState.count + 3}),
      prevState => ({count: prevState.count + 5}),
      prevState => ({count: prevState.count + 10}),
    );

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('top level default reducer sees undefined prev state', t => {
  t.plan(4);

  function main(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    sources.onion.state$.addListener({
      next(x) { t.is(x.foo, 'bar'); },
      error(e) { t.fail(e); },
      complete() {},
    });

    return {
      onion: xs.of(function defaultReducer(prevState) {
        t.is(typeof prevState, 'undefined');
        if (typeof prevState === 'undefined') {
          return {foo: 'bar'};
        } else {
          return prevState;
        }
      }),
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('child component default reducer can get state from parent', t => {
  t.plan(3);

  function child(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [7];
    sources.onion.state$.addListener({
      next(x) { t.is(x.count, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });
    const reducer$ = xs.of(function defaultReducer(prevState) {
      if (typeof prevState === 'undefined') {
        return {count: 0};
      } else {
        return prevState;
      }
    });
    return {
      onion: reducer$,
    };
  }

  function main(sources) {
    const childSinks = isolate(child, 'child')(sources);
    const childReducer$ = childSinks.onion;

    const parentReducer$ = xs.of(function initReducer(prevState) {
      return { child: { count: 7 } };
    });
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('child component default reducer can set default state', t => {
  t.plan(3);

  function child(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [0];
    sources.onion.state$.addListener({
      next(x) { t.is(x.count, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });
    const reducer$ = xs.of(function defaultReducer(prevState) {
      if (typeof prevState === 'undefined') {
        return {count: 0};
      } else {
        return prevState;
      }
    });
    return {
      onion: reducer$,
    };
  }

  function main(sources) {
    const childSinks = isolate(child, 'child')(sources);
    const childReducer$ = childSinks.onion;

    const parentReducer$ = xs.of(function initReducer(prevState) {
      return { };
    });
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('child component can be isolated with a lens object as scope', t => {
  t.plan(6);

  function child(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [27, 37];
    sources.onion.state$.addListener({
      next(x) { t.is(x.celsius, expected.shift()); },
      error(e) { t.fail(e.message); },
      complete() {},
    });
    const reducer$ = xs.of(function increment(prevState) {
      return {celsius: prevState.celsius + 10};
    });
    return {
      onion: reducer$,
    };
  }

  function main(sources) {
    const celsiusLens = {
      get: (state) =>
        ({celsius: (state.deeply.nested.prop.kelvin - 273)}),
      set: (state, childState) =>
        ({deeply: {nested: {prop: {kelvin: childState.celsius + 273}}}}),
    };

    const childSinks = isolate(child, {onion: celsiusLens})(sources);
    const childReducer$ = childSinks.onion;

    const expected = [300, 310];
    sources.onion.state$.addListener({
      next(s) { t.is(s.deeply.nested.prop.kelvin, expected.shift()); },
      error(e) { t.fail(e.message); },
      complete() {},
    });

    const parentReducer$ = xs.of(function initReducer(prevState) {
      return {
        deeply: {
          nested: {
            prop: {
              kelvin: 300,
            }
          }
        }
      };
    });
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('child component also gets undefined if parent has not initialized state', t => {
  t.plan(1);

  function child(sources) {
    const expected = [0];
    sources.onion.state$.addListener({
      next(x) { t.is(x.count, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });
    const reducer$ = xs.of(function defaultReducer(prevState) {
      if (typeof prevState === 'undefined') {
        return {count: 0};
      } else {
        return prevState;
      }
    });
    return {
      onion: reducer$,
    };
  }

  function main(sources) {
    const childSinks = isolate(child, 'child')(sources);
    const childReducer$ = childSinks.onion;

    const reducer$ = childReducer$;

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('should work with a manually isolated child component', t => {
  t.plan(7);

  function child(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [7, 9];
    sources.onion.state$.addListener({
      next(x) { t.is(x.count, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });
    const reducer$ = xs.of(
      prevState => ({count: prevState.count + 2}),
    );
    return {
      onion: reducer$,
    };
  }

  function main(sources) {
    const expected = [7, 9];
    sources.onion.state$.addListener({
      next(x) { t.is(x.child.count, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });

    const childSinks = child({onion: isolateSource(sources.onion, 'child')});
    t.truthy(childSinks.onion);
    const childReducer$ = isolateSink(childSinks.onion, 'child');

    const parentReducer$ = xs.of(function initReducer(prevState) {
      return { child: { count: 7 } };
    });
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('should work with an isolated child component', t => {
  t.plan(9);

  function child(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [7, 9];
    sources.onion.state$.addListener({
      next(x) { t.is(x.count, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });
    const reducer$ = xs.of(
      prevState => ({count: prevState.count + 2}),
    );
    return {
      onion: reducer$,
    };
  }

  function main(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [7, 9];
    sources.onion.state$.addListener({
      next(x) { t.is(x.child.count, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });

    const childSinks = isolate(child, 'child')(sources);
    t.truthy(childSinks.onion);
    const childReducer$ = childSinks.onion;

    const parentReducer$ = xs.of(function initReducer(prevState) {
      return { child: { count: 7 } };
    });
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('should work with an isolated child component and falsy values', t => {
  t.plan(11);

  function child(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [1, 0, -1];
    sources.onion.state$.addListener({
      next(x) { t.is(x, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });
    const reducer$ = xs.of(
      prevCount => prevCount - 1,
      prevCount => prevCount - 1,
    );
    return {
      onion: reducer$,
    };
  }

  function main(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [1, 0, -1];
    sources.onion.state$.addListener({
      next(x) { t.is(x.count, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });

    const childSinks = isolate(child, 'count')(sources);
    t.truthy(childSinks.onion);
    const childReducer$ = childSinks.onion;

    const parentReducer$ = xs.of(function initReducer(prevState) {
      return { count: 1 };
    });
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('should work with an isolated child component on an array subtree', t => {
  t.plan(9);

  function child(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [[3], [3,5]];
    sources.onion.state$.addListener({
      next(x) { t.deepEqual(x, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });
    const reducer$ = xs.of(
      prevArr => prevArr.concat(5)
    );
    return {
      onion: reducer$,
    };
  }

  function main(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [[3], [3,5]];
    sources.onion.state$.addListener({
      next(x) { t.deepEqual(x.list, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });

    const childSinks = isolate(child, 'list')(sources);
    t.truthy(childSinks.onion);
    const childReducer$ = childSinks.onion;

    const parentReducer$ = xs.of(function initReducer(prevState) {
      return { list: [3] };
    });
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test('should work with an isolated child component on an array entry', t => {
  t.plan(11);

  function secondEntry(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [5, 15, 6];
    sources.onion.state$.addListener({
      next(x) { t.deepEqual(x, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });
    const reducer$ = xs.of(
      prevNum => prevNum + 10,
      prevNum => void 0
    );
    return {
      onion: reducer$,
    };
  }

  function main(sources) {
    t.truthy(sources.onion);
    t.truthy(sources.onion.state$);
    const expected = [[3,5,6], [3,15,6], [3,6]];
    sources.onion.state$.addListener({
      next(x) { t.deepEqual(x, expected.shift()); },
      error(e) { t.fail(e); },
      complete() {},
    });

    const childSinks = isolate(secondEntry, 1)(sources);
    t.truthy(childSinks.onion);
    const childReducer$ = childSinks.onion;

    const parentReducer$ = xs.of(function initReducer(prevState) {
      return [3,5,6];
    });
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(main);
  wrapped({});
});

test.cb('should work with collection() and an isolated list children', t => {
  t.plan(6);

  function Child(sources) {
    const defaultReducer$ = xs.of(prev => {
      if (typeof prev.val === 'number') {
        return prev;
      } else {
        return {key: prev.key, val: 10};
      }
    });

    const deleteReducer$ = xs.of(prev =>
      prev.key === 'c' ? void 0 : prev
    ).compose(delay(50));

    return {
      onion: xs.merge(defaultReducer$, deleteReducer$),
    };
  }

  function List(sources) {
    return sources.onion.asCollection(Child, sources).toSinks();
  }

  function Main(sources) {
    const expected = [
      [{key: 'a', val: 3}],
      [{key: 'a', val: 3}, {key: 'b', val: null}],
      [{key: 'a', val: 3}, {key: 'b', val: 10}],
      [{key: 'a', val: 3}, {key: 'b', val: 10}, {key: 'c', val: 27}],
      [{key: 'a', val: 3}, {key: 'b', val: 10}]
    ];

    sources.onion.state$.addListener({
      next(x) {
        t.deepEqual(x.list, expected.shift());
        if (expected.length === 0) {
          t.pass();
          t.end();
        }
      },
      error(e) {
        t.fail(e.message);
      },
      complete() {
        t.fail('complete should not be called');
      },
    });

    const childSinks = isolate(List, 'list')(sources);
    const childReducer$ = childSinks.onion;

    const initReducer$ = xs.of(function initReducer(prevState) {
      return { list: [{key: 'a', val: 3}] };
    });

    const addReducer$ = xs.of(function addB(prev) {
      return {list: prev.list.concat({key: 'b', val: null})};
    }, function addC(prev) {
      return {list: prev.list.concat({key: 'c', val: 27})};
    }).compose(delay(100));

    const parentReducer$ = xs.merge(initReducer$, addReducer$)
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(Main);
  wrapped({});
});

test.cb('should work with collection() and a custom item key', t => {
  t.plan(6);

  function Child(sources) {
    const defaultReducer$ = xs.of(prev => {
      if (typeof prev.val === 'number') {
        return prev;
      } else {
        return {id: prev.id, val: 10};
      }
    });

    const deleteReducer$ = xs.of(prev =>
      prev.id === 'c' ? void 0 : prev
    ).compose(delay(50));

    return {
      onion: xs.merge(defaultReducer$, deleteReducer$),
    };
  }

  function List(sources) {
    return sources.onion.asCollection(Child, sources, s => s.id).toSinks();
  }

  function Main(sources) {
    const expected = [
      [{id: 'a', val: 3}],
      [{id: 'a', val: 3}, {id: 'b', val: null}],
      [{id: 'a', val: 3}, {id: 'b', val: 10}],
      [{id: 'a', val: 3}, {id: 'b', val: 10}, {id: 'c', val: 27}],
      [{id: 'a', val: 3}, {id: 'b', val: 10}]
    ];

    sources.onion.state$.addListener({
      next(x) {
        t.deepEqual(x.list, expected.shift());
        if (expected.length === 0) {
          t.pass();
          t.end();
        }
      },
      error(e) {
        t.fail(e.message);
      },
      complete() {
        t.fail('complete should not be called');
      },
    });

    const childSinks = isolate(List, 'list')(sources);
    const childReducer$ = childSinks.onion;

    const initReducer$ = xs.of(function initReducer(prevState) {
      return { list: [{id: 'a', val: 3}] };
    });

    const addReducer$ = xs.of(function addB(prev) {
      return {list: prev.list.concat({id: 'b', val: null})};
    }, function addC(prev) {
      return {list: prev.list.concat({id: 'c', val: 27})};
    }).compose(delay(100));

    const parentReducer$ = xs.merge(initReducer$, addReducer$)
    const reducer$ = xs.merge(parentReducer$, childReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(Main);
  wrapped({});
});

test.cb('should work with asCollection() on an object, not an array', t => {
  t.plan(3);

  function Child(sources) {
    const defaultReducer$ = xs.of(prev => {
      if (typeof prev.val === 'number') {
        return prev;
      } else {
        return {key: prev.key, val: 10};
      }
    });

    return {
      onion: defaultReducer$,
    };
  }

  function Wrapper(sources) {
    return sources.onion.asCollection(Child, sources).toSinks();
  }

  function Main(sources) {
    const expected = [
      {key: 'a', val: null},
      {key: 'a', val: 10},
    ];

    sources.onion.state$.addListener({
      next(x) {
        t.deepEqual(x.wrap, expected.shift());
        if (expected.length === 0) {
          t.pass();
          t.end();
        }
      },
      error(e) {
        t.fail(e.message);
      },
      complete() {
        t.fail('complete should not be called');
      },
    });

    const wrapperSinks = isolate(Wrapper, 'wrap')(sources);
    const wrapperReducer$ = wrapperSinks.onion;

    const initReducer$ = xs.of(function initReducer(prevState) {
      return { wrap: {key: 'a', val: null} };
    });

    const reducer$ = xs.merge(initReducer$, wrapperReducer$);

    return {
      onion: reducer$,
    };
  }

  const wrapped = onionify(Main);
  wrapped({});
});
