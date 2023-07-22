const { LocalEventBus } = require('../dist');
const { sleep } = require('./util');

async function createWorker() {
  const bus = new LocalEventBus({
    isWorker: true,
  });

  bus.subscribe((message, callback) => {
    callback && callback.send(message);
  });

  await sleep();
  await bus.start();
}

createWorker().then(() => {
  console.log('local ready');
});
