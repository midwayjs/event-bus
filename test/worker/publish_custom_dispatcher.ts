import { ThreadEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ThreadEventBus({
    isWorker: true,
  });

  bus.subscribe((message, callback) => {
    callback && callback.send(bus.getWorkerId());
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
