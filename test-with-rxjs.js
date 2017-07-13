import test from 'ava';
import {Observable} from 'rxjs';
import {run} from '@cycle/rxjs-run';
import onionify from './lib/index';

test('StateSource.state$ should be an Observable', t => {
  t.plan(1);
  function main(sources) {
    t.is(typeof sources.onion.state$.switchMap, 'function');
    return {
      onion: Observable.never(),
    };
  }

  run(onionify(main), {dummy: () => {}});
});

test('StateSource.select(s).state$ should be an Observable', t => {
  t.plan(1);
  function main(sources) {
    t.is(typeof sources.onion.select('foo').state$.switchMap, 'function');
    return {
      onion: Observable.never(),
    };
  }

  run(onionify(main), {dummy: () => {}});
});

test('StateSource.toCollection.build.pickCombine should be an Observable', t => {
  t.plan(1);

  function child(sources) {
    return {
      onion: Observable.never(),
    };
  }

  function main(sources) {
    const obs = sources.onion
      .toCollection(child)
      .build(sources)
      .pickCombine('onion');
    t.is(typeof obs.switchMap, 'function');
    return {
      onion: Observable.never(),
    };
  }

  run(onionify(main), {dummy: () => {}});
});

test('StateSource.toCollection.build.pickMerge should be an Observable', t => {
  t.plan(1);

  function child(sources) {
    return {
      onion: Observable.never(),
    };
  }

  function main(sources) {
    const obs = sources.onion
      .toCollection(child)
      .build(sources)
      .pickMerge('onion');
    t.is(typeof obs.switchMap, 'function');
    return {
      onion: Observable.never(),
    };
  }

  run(onionify(main), {dummy: () => {}});
});

test('StateSource.toCollection.uniqueBy.isolateEach.build.pickMerge should be an Observable', t => {
  t.plan(1);

  function child(sources) {
    return {
      onion: Observable.never(),
    };
  }

  function main(sources) {
    const obs = sources.onion
      .toCollection(child)
      .uniqueBy(s => s.key)
      .isolateEach(s => s)
      .build(sources)
      .pickMerge('onion');
    t.is(typeof obs.switchMap, 'function');
    return {
      onion: Observable.never(),
    };
  }

  run(onionify(main), {dummy: () => {}});
});