import { ThreadEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ThreadEventBus();

  bus.subscribe((message, responder) => {
    if (responder) {
      responder.send('hello');
      responder.send(' world');
      responder.end();
    }
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
