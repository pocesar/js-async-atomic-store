import AwaitLock from 'await-lock'

export interface Methods<KEY, VALUE, SOURCE> {
  /** Read the underlying store using the provided key. Waits until the async computation is done */
  read(key: KEY): Promise<VALUE>
  /** Write in an atomic manner, as it will be the only write at the invocation time */
  write(key: KEY, value: VALUE): Promise<void>
  /** Transforms an index value at the specific point-in-time on invocation */
  append(key: KEY, transform: (currentValue: VALUE) => Promise<VALUE> | VALUE): Promise<VALUE>
  /** Acquires the lock and manipulate the underlying store manually */
  lock<T = unknown>(cb: (source: SOURCE) => Promise<T>): Promise<T | void>
  /** Returns the internal state of the store */
  data(): Promise<SOURCE>
}

export interface Options<KEY, VALUE, SOURCE> {
  read: (key: KEY) => Promise<VALUE>
  write: (key: KEY, value: VALUE) => Promise<any>
  data: () => Promise<SOURCE>
}

/**
 * Do a datastore-wide lock when calling any methods.
 * Guarantees point-in-time data reading and atomic writes
 */
export const AsyncAtomicStore = <KEY, VALUE, SOURCE>(
  creationOptions: Options<KEY, VALUE, SOURCE>
): Methods<KEY, VALUE, SOURCE> => {
  const lock = new AwaitLock()

  const { read, write, data } = creationOptions

  return {
    async read(key) {
      await lock.acquireAsync()

      try {
        return await read(key)
      } finally {
        lock.release()
      }
    },
    async lock(cb) {
      await lock.acquireAsync()

      try {
        return cb(await data())
      } finally {
        lock.release()
      }
    },
    async write(key, value) {
      await lock.acquireAsync()

      try {
        await write(key, value)
      } finally {
        lock.release()
      }
    },
    async append(key, transform) {
      await lock.acquireAsync()

      try {
        const value = await transform(
          await read(key)
        )

        await write(key, value)

        return value
      } finally {
        lock.release()
      }
    },
    async data() {
      await lock.acquireAsync()

      try {
        return data()
      } finally {
        lock.release()
      }
    }
  }
}

/**
 * Wraps an existing array or generate a new one if nothing is passed
 */
export const AsyncArray = <T = unknown>(array?: T[]) => {
  const innerArray: T[] = array || []

  return AsyncAtomicStore<number, T, T[]>({
    data: async () => innerArray,
    read: async (index) => innerArray[index],
    write: async (index, value) => {
      innerArray[index] = value
    }
  })
}

/**
 * Wraps an existing object or generate a new one if nothing is passed
 */
export const AsyncObject = <T extends any = unknown>(obj?: T) => {
  const innerObj: T = obj || Object.create(null)

  return AsyncAtomicStore<
    keyof T,
    T extends { [index in keyof T]: infer V } ? V : any,
    T
  >({
    data: async () => innerObj,
    read: async (index) => innerObj[index],
    write: async (index, value) => {
      innerObj[index] = value
    }
  })
}

/**
 * Wraps an existing Map or generate a new one if nothing is passed
 */
export const AsyncMap = <K = string, V = unknown, T extends Map<any, any> = Map<K, V>>(map?: T) => {
  const innerMap = map || new Map()

  type KEY = T extends Map<infer KEY, any> ? KEY : any
  type VALUE = T extends Map<any, infer VALUE> ? VALUE : any

  return AsyncAtomicStore<KEY, VALUE | undefined, Map<KEY, VALUE>>({
    data: async () => innerMap,
    read: async (key) => innerMap.get(key),
    write: async (key, value) => {
      innerMap.set(key, value!)
    },
  })
}
