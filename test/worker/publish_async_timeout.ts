import { ThreadEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ThreadEventBus();

  bus.subscribe((message, callback) => {
    console.log(message);
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
