import { LocalEventBus } from '../../src/index';
import { sleep } from '../util';

async function createWorker() {
  const bus = new LocalEventBus({
    isWorker: true,
  });

  await sleep();
  await bus.start();

  bus.subscribe(message => {
    if (message.body === 'just you') {
      // broadcast to main, and send to all worker
      bus.broadcast('hello world', {
        includeSelfFromWorker: true,
      });
    } else if (message.body === 'hello world') {
      console.log('got it');
      bus.publish('got it');
    }
  });
}

createWorker().then(() => {
  console.log('ready');
});
