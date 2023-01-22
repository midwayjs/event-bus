import { ThreadEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ThreadEventBus({
    isWorker: true,
  });

  const err = new Error('custom error');
  err.name = 'CustomError';
  await bus.start(err);
}

createWorker().then(() => {
  console.log('ready');
});
