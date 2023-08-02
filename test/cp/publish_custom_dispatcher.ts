import { ChildProcessEventBus } from '../../src';

async function createWorker() {
  const bus = new ChildProcessEventBus({
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
