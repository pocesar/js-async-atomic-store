import AwaitLock from 'await-lock'

export interface Methods<KEY, VALUE, SOURCE> {
  read(key: KEY): Promise<VALUE>
  write(key: KEY, value: VALUE): Promise<void>
  append(key: KEY, transform: (currentValue: VALUE) => Promise<VALUE> | VALUE): Promise<VALUE>
  data(): Promise<SOURCE>
}

export interface Options<KEY, VALUE, SOURCE> {
  read: (key: KEY) => Promise<VALUE>
  write: (key: KEY, value: VALUE) => Promise<any>
  data: () => Promise<SOURCE>
}

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