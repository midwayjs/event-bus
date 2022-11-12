import { ChildProcessEventBus } from '../../src';

async function createWorker() {
  const bus = new ChildProcessEventBus({
    isWorker: true,
  });
  await bus.start();

  bus.subscribe(message => {
    if (message.body === 'just you') {
      // broadcast to main, and send to all worker
      bus.broadcast('hello world', {
        includeSelfFromWorker: true,
      });
    } else if (message.body === 'hello world') {
      bus.publish('got it');
    }
  });
}

createWorker().then(() => {
  console.log('ready');
});
