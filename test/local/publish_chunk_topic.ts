import { LocalEventBus } from '../../src/index';
import { sleep } from '../util';
async function createWorker() {
  const bus = new LocalEventBus({
    isWorker: true,
  });
  await bus.start();
  bus.subscribe(async (message, responder) => {

    await sleep();

    if (responder) {
      responder.send('hello');
      responder.send(' world');
      responder.end();
    }
  }, {
    topic: 'in-request',
  });
}
createWorker().then(() => {
  console.log('ready');
});
