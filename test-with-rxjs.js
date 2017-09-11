import test from 'ava';
import {Observable} from 'rxjs';
import {run} from '@cycle/rxjs-run';
import onionify, {makeCollection} from './lib/index';

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

test('makeCollection pickCombine sinks should be Observables', t => {
  t.plan(1);

  function child(sources) {
    return {
      onion: Observable.never(),
    };
  }

  function main(sources) {
    const List = makeCollection({
      item: child,
      collectSinks: instances => ({
        onion: instances.pickCombine('onion')
      }),
    });
    const obs = List(sources).onion;
    t.is(typeof obs.switchMap, 'function');
    return {
      onion: Observable.never(),
    };
  }

  run(onionify(main), {dummy: () => {}});
});

test('makeCollection pickMerge sinks should be Observables', t => {
  t.plan(1);

  function child(sources) {
    return {
      onion: Observable.never(),
    };
  }

  function main(sources) {
    const List = makeCollection({
      item: child,
      collectSinks: instances => ({
        onion: instances.pickMerge('onion')
      }),
    });
    const obs = List(sources).onion;
    t.is(typeof obs.switchMap, 'function');
    return {
      onion: Observable.never(),
    };
  }

  run(onionify(main), {dummy: () => {}});
});
