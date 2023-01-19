import { ChildProcessEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ChildProcessEventBus();

  bus.subscribe((message, callback) => {
    console.log(message);
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
