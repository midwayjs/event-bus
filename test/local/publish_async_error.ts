import { LocalEventBus } from '../../src/index';
import { sleep } from '../util';

async function createWorker() {
  const bus = new LocalEventBus({
    isWorker: true,
  });

  bus.subscribe(async (message, callback) => {
    const err = new Error('custom error');
    err.name = 'CustomError';
    throw err;
  });
  await sleep();
  await bus.start();
}
createWorker().then(() => {
  console.log('ready');
});
