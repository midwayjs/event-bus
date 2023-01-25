import { ChildProcessEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ChildProcessEventBus({
    isWorker: true,
  });

  bus.subscribe((message, responder) => {
    if (responder) {
      responder.send('hello');
      responder.send(' world');
      responder.end();
    }
  }, {
    topic: 'in-request',
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
