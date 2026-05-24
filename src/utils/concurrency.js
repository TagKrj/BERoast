export const createConcurrencyLimiter = (maxConcurrent = 5) => {
  const limit = Math.max(1, Number.parseInt(maxConcurrent, 10) || 1);
  const queue = [];
  let activeCount = 0;

  const runNext = () => {
    if (activeCount >= limit || queue.length === 0) {
      return;
    }

    const { task, resolve, reject } = queue.shift();
    activeCount += 1;

    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        activeCount -= 1;
        runNext();
      });
  };

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      runNext();
    });
};
