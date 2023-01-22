import { ThreadEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ThreadEventBus({
    isWorker: true,
  });

  bus.subscribe((message, callback) => {
    const err = new Error('custom error');
    err.name = 'CustomError';
    throw err;
  });

  await bus.start();
}
createWorker().then(() => {
  console.log('ready');
});
