import xs from 'xstream';
import {run} from '@cycle/run';
import {makeDOMDriver} from '@cycle/dom';
import onionify from 'cycle-onionify';
import RadioApp from './RadioApp';

const main = onionify(RadioApp);

run(main, {
  DOM: makeDOMDriver('#main-container')
});
