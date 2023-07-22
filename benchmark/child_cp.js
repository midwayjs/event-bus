const { ChildProcessEventBus } = require('../dist');

async function createWorker() {
  const bus = new ChildProcessEventBus({
    isWorker: true,
  });

  bus.subscribe((message, callback) => {
    callback && callback.send(message);
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('child process ready');
});
