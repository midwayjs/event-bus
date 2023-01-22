import { ChildProcessEventBus } from '../../src';

async function createWorker() {
  const bus = new ChildProcessEventBus({
    isWorker: true,
  });

  bus.subscribe((message, callback) => {
    console.log(message);

    callback && callback.send({
      data: 'hello world'
    });
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
