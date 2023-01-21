import { LocalEventBus } from '../../src/index';
import { sleep } from '../util';

async function createWorker() {
  const bus = new LocalEventBus({
    isWorker: true,
  });

  bus.subscribe(async (message, responder) => {
    await sleep();
    if (responder) {
      responder.send('hello');
      responder.send(' world');
    }
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
