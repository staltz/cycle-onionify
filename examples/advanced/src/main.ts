import xs from 'xstream';
import {run} from '@cycle/run';
import {makeDOMDriver} from '@cycle/dom';
import onionify from 'cycle-onionify';
import TodoApp from './TodoApp';

const main = onionify(TodoApp);

run(main, {
  DOM: makeDOMDriver('#main-container')
});
