export const sleep = (time: number) => {
  return new Promise((r) => setTimeout(r, time))
}