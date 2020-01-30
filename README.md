[![NPM](https://img.shields.io/npm/l/async-atomic-store)](https://www.npmjs.com/package/async-atomic-store)
[![npm](https://img.shields.io/npm/v/async-atomic-store)](https://www.npmjs.com/package/async-atomic-store)
[![npm](https://img.shields.io/npm/types/async-atomic-store)](https://www.npmjs.com/package/async-atomic-store)
[![Travis (.org)](https://img.shields.io/travis/pocesar/js-async-atomic-store)](https://travis-ci.org/pocesar/js-async-atomic-store)
[![Coverage Status](https://coveralls.io/repos/github/pocesar/js-async-atomic-store/badge.svg?branch=master)](https://coveralls.io/github/pocesar/js-async-atomic-store?branch=master)

# async-atomic-store

An agnostic little store abstraction for reading, writing and appending on the same data from multiple sources in a locking manner, that allows concurrent/parallel (like from many async sources) write, append and read.

## API

The interface is simple, you provide your `read`, `write` and `data` methods, and it outputs an async-locking `write`, `read`, `append`, `lock` and `data` methods.

All those methods are async (return a promise), even if they have non-async data underneath, because of the async locking mechanism, which is similar to a `LOCK TABLE` and not `LOCK ROW`. This does not use loops or saturate the event loop.

If any method `throw`, the lock will be released and no changes are made.

```ts
const store = AsyncAtomicStore<KEY_OR_ID, TYPE_OR_SHAPE_OF_VALUE, TYPE_OF_STORAGE>({
  data: async () => { /* your underlying data */ },
  read: async (key) => { /* query a database, read from your datasource */ },
  write: async (key, value) => { /* writes in a atomic locking manner */ }
});

// guaranteed to return that point-in-time value
const value = await store.read("id");

// at this exact point, "id" will be "my value"
await store.write("id", "my value");

// passes the current value to the callback, modify it then write at the same key.
// transformedValue = "my value + my value"
const transformedValue = await store.append("id", async (currentValue) => {
  return `${currentValue} + ${currentValue}`;
});

// locks everything, passes the current point-in-time datasource, and return an arbitrary value.
// This exists for everything that isn't covered by the other "keyed" methods, but you need to
// do some async work before returning a value
// value = "ok"
const value = await store.lock(async (datasource) => {
  datasource[42] = "the answer";
  return "ok";
});
```

Provides the following type-safe adapters for your data:

### AsyncArray

```ts
import { AsyncArray } from 'async-atomic-store'

const myArray = [];
const store = AsyncArray(myArray);
await store.write(0, "ok");
await store.lock(async (arr) => {
  arr.push("item"); // there's no other way to manipulate an array other than using lock()
});

myArray[0] === "ok";
myArray[1] === "item";
```

### AsyncMap

```ts
import { AsyncMap } from 'async-atomic-store'

const myMap = new Map<string, string>();
const store = AsyncMap(myMap);
await store.write("str", "ing");

myMap.get("str") === "ing";
```

### AsyncObject

```ts
import { AsyncObject } from 'async-atomic-store'

const myObj = Object.create(null);
const store = AsyncObject(myObj);
await store.lock(async (obj) => {
  obj.goCrazy = {
    with: {
      it: true
    }
  }
});

myObj.goCrazy.with.it === true;
```

## Examples

Explicit implementations of different data sources

Using `Map`

```ts
import { AsyncAtomicStore } from 'async-atomic-store'

const lockingMap = () => {
  const map = new Map<number, DeepObject>()

  return AsyncAtomicStore<number, DeepObject | undefined, typeof map>({
    data: async () => map,
    read: async (key) => map.get(key),
    write: async (key, value) => map.set(key, value!)
  })
}

const store = lockingMap()

for (let i = 0; i < 10; i++) {
  // don't await
  setTimeout(() => {
    store.append(1, (value) => {
      return {
        ...value,
        deep: {
          object: {
            1: (value ? value.deep.object[1] : 0) + i
            // the first lock will initialize the value to 0
            // all subsequent writes will use the current value,
          }
        }
      }
    })
  }, Math.round(Math.random() * 2))
}

assert(
  (await store.data()).get(1)!.deep.object[1] === 45,
  'Object value should always be 45'
)
```

Using `Set`:

```ts
const setStore = () => {
  const set = new Set<string>()

  return AsyncAtomicStore<number, string | undefined, string[]>({
    read: async (index) => index ? [...set.values()][index] : undefined,
    write: async (index, value) => {
      const kvs = [...set.values()]
      set.clear() // set needs to be recreated each time
      kvs[index] = value!
      kvs.forEach((v) => set.add(v))
      await sleep(2)
    },
    data: async () => [...set.values()]
  })
}

const store = setStore()

await Promise.all([
  store.write(0, '0'),
  store.write(1, '5'),
  store.write(1, '1'),
  store.write(2, '7'),
  store.write(2, '2'),
  store.write(3, '3'),
])

const data = await store.data()

assert(
  data.join('') === '0123',
  'set should be exactly 0123'
)
```

Redundantly using `Atomics` and `SharedArrayBuffer`:

```ts
import { AsyncAtomicStore } from 'async-atomic-store'

const uint8Array = () => {
  const buffer = new SharedArrayBuffer(16)
  const uint8 = new Uint8Array(buffer)

  return AsyncAtomicStore<number, number, Uint8Array>({
    read: async (index) => Atomics.load(uint8, index),
    write: async (index, value) => Atomics.store(uint8, index, value),
    data: async () => uint8
  })
}

const store = uint8Array()

for (let i = 0; i < 16; i++) {
  setTimeout(async () => {
    store.append(1, (currentValue) => {
      return currentValue + i
    })
  }, Math.round(Math.random() * 2))
}

store.append(1, (currentValue) => currentValue + 1)

const currentData = await store.data()

assert(
  currentData[1] === 121,
  'Index 1 should be 121'
)
```

## License

MIT

