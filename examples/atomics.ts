import { AsyncAtomicStore } from '../src/index'
import { sleep } from '../src/common'
import assert from 'assert'

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

const main = async () => {
for (let i = 0; i < 16; i++) {
  setTimeout(async () => {
    console.log('execution order', i)
    store.append(1, (currentValue) => {
      return currentValue + i
    })
  }, Math.round(Math.random() * 2))
}

store.append(1, (currentValue) => currentValue + 1)

await sleep(32) // wait for everything to settle

const currentData = await store.data()

assert(
  currentData[1] === 121,
  'Index 1 should be 121'
)

  console.log(currentData)
}

main()