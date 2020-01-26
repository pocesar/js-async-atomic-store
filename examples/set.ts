import { AsyncAtomicStore } from '../src/index'
import assert from 'assert'
import { sleep } from '../src/common'

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

const main = async () => {
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

  console.log(data)

  assert(
    data.join('') === '0123',
    'set should be exactly 0123'
  )
}

main()