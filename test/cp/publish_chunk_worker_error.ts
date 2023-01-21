import { ChildProcessEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ChildProcessEventBus({
    isWorker: true,
  });

  bus.subscribe((message, responder) => {
    if (responder) {
      responder.send('hello');
      const err = new Error('custom error');
      err.name = 'CustomError';
      responder.error(err);
    }
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
