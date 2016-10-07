import test from 'ava';
import xs from 'xstream';
import isolate from '@cycle/isolate';
import onionify, {pick, mix} from './lib/index';

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

test('pick operator works with string argument', t => {
  t.plan(3);

  const sinksArray$ = xs.of([{foo: 10, bar: 20}, {foo: 11, bar: 21}]);
  const fooArray$ = sinksArray$.compose(pick('foo'));

  fooArray$.addListener({
    next(arr) {
      t.is(arr.length, 2);
      t.is(arr[0], 10);
      t.is(arr[1], 11);
    },
    error(e) { t.fail(e); },
    complete() {},
  });
});

test('pick operator works with function argument', t => {
  t.plan(3);

  const sinksArray$ = xs.of([{foo: 10, bar: 20}, {foo: 11, bar: 21}]);
  const barArray$ = sinksArray$.compose(pick(sinks => sinks.bar));

  barArray$.addListener({
    next(arr) {
      t.is(arr.length, 2);
      t.is(arr[0], 20);
      t.is(arr[1], 21);
    },
    error(e) { t.fail(e); },
    complete() {},
  });
});

test('mix operator works with xs.combine', t => {
  t.plan(3);

  const sinksArray$ = xs.of(
    [xs.of(10), xs.of(11)]
  );
  const fooCombinedArray$ = sinksArray$.compose(mix(xs.combine));

  fooCombinedArray$.addListener({
    next(arr) {
      t.is(arr.length, 2);
      t.is(arr[0], 10);
      t.is(arr[1], 11);
    },
    error(e) { t.fail(e); },
    complete() {},
  });
});

test('pick and mix operators work together', t => {
  t.plan(3);

  const sinksArray$ = xs.of(
    [
      {foo: xs.of(10), bar: xs.of(20)},
      {foo: xs.of(11), bar: xs.of(21)}
    ]
  );
  const barArray$ = sinksArray$
    .compose(pick('bar'))
    .compose(mix(xs.combine));

  barArray$.addListener({
    next(arr) {
      t.is(arr.length, 2);
      t.is(arr[0], 20);
      t.is(arr[1], 21);
    },
    error(e) { t.fail(e); },
    complete() {},
  });
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
