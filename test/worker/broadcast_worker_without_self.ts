import { ThreadEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ThreadEventBus();
  await bus.start();

  bus.subscribe(message => {
    if (message.body === 'just you') {
      // broadcast to main, and send to all worker
      bus.broadcast({
        data: 'hello world',
        workerId: bus.getWorkerId(),
      });
    } else if (message.body.data === 'hello world') {
      if (message.body.workerId !== bus.getWorkerId()) {
        bus.publish('got it');
      } else {
        bus.publish('fail');
      }
    }
  });
}

createWorker().then(() => {
  console.log('ready');
});