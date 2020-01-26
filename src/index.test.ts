import { AsyncAtomicStore } from './index'
import { sleep } from './common'

describe('AsyncAtomicStore', () => {
  test('map', async () => {
    interface DeepObject {
      deep: {
        object: {
          [index: number]: number
        }
      }
    }

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
                ...((value || {}).deep || {}).object,
                [i]: i,
                1: (value ? value.deep.object[1] : 0) + i,
              }
            }
          }
        })
      }, Math.round(Math.random() * 2))
    }

    await sleep(16) // wait for everything to settle

    const currentData = (await store.data()).get(1)!

    expect(currentData.deep.object[1]).toEqual(45)
    expect(Object.keys(currentData.deep.object).length).toEqual(10)
  })

  test('atomics', async () => {
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

    await sleep(32) // wait for everything to settle

    const currentData = await store.data()

    expect(currentData[1]).toEqual(121)
  })

  test('set', async () => {
    const setStore = () => {
      const set = new Set<string>()

      return AsyncAtomicStore<number, string | undefined, string[]>({
        read: async (index) => index ? [...set.values()][index] : undefined,
        write: async (index, value) => {
          const kvs = [...set.values()]
          set.clear() // set needs to be recreated each time
          kvs[index] = value!
          kvs.forEach((v) => set.add(v))
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

    expect(data.join('')).toEqual('0123')
  })
})
