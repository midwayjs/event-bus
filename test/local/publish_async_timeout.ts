import { LocalEventBus } from '../../src/index';
import { sleep } from '../util';

async function createWorker() {
  const bus = new LocalEventBus({
    isWorker: true,
  });

  bus.subscribe((message, callback) => {
    console.log(message);
  });

  await sleep();
  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
