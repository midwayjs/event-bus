const { ThreadEventBus } = require('../dist');

async function createWorker() {
  const bus = new ThreadEventBus({
    isWorker: true,
  });

  bus.subscribe((message, callback) => {
    callback && callback.send(message);
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('thread ready');
});
