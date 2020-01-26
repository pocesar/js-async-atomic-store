import { AsyncAtomicStore } from '../src/index'
import { sleep } from '../src/common'
import assert from 'assert'

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

const main = async () => {
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

  console.log(currentData)

  assert(
    currentData.deep.object[1] === 45,
    'Object value should always be 45'
  )
  assert(
    Object.keys(currentData.deep.object).length === 10,
    'Deep object should have 10 properties'
  )
}

main()