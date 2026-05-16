type Task<T> = () => Promise<T>;

export function pLimit(concurrency: number) {
  if (concurrency < 1) throw new RangeError("Concurrency must be at least 1");

  let active = 0;
  const queue: Array<{
    fn: Task<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift()!;
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        active--;
        next();
      });
  };

  const limit = <T>(fn: Task<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push({ fn, resolve, reject } as any);
      next();
    });

  // Extra utility props
  Object.defineProperties(limit, {
    activeCount:  { get: () => active },
    pendingCount: { get: () => queue.length },
    clearQueue:   { value: () => queue.splice(0) },
  });

  return limit as typeof limit & {
    readonly activeCount: number;
    readonly pendingCount: number;
    clearQueue: () => void;
  };
}