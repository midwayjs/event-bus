import { ThreadEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ThreadEventBus({
    isWorker: true,
  });

  bus.subscribe((message, responder) => {
    if (responder) {
      responder.send('hello');
      responder.end(' world');
    }
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
