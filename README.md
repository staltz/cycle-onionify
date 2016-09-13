# onionify

##### Work in progress

Augments your Cycle.js main function with onion-shaped state management.

```
npm install cycle-onionify
```

Raw example:

```js
import onionify from 'cycle-onionify';

function main(sources) {
  // sources.onion is a stream of "The big state tree"

  return {
    onion: reducer$, // stream of reducer functions
  };
}

Cycle.run(onionify(main), drivers);
```

If you want to choose what key to use in sources and sinks (the default is `onion`), pass it as the second argument to onionify:

```js
import onionify from 'cycle-onionify';

function main(sources) {
  // sources.stuff is a stream of "The big state tree"

  return {
    stuff: reducer$, // stream of reducer functions
  };
}

Cycle.run(onionify(main, 'stuff'), drivers);
```