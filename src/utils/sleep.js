let wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export function sleep(ms) {
  return wait(ms);
}

export function useSleep(fn) {
  wait = fn;
}
