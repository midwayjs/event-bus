import { ThreadEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ThreadEventBus({
    isWorker: true,
  });

  bus.subscribe(message=>{
    console.log(message);

    bus.publish({
      data: 'hello world'
    });
  },
  {
    topic: 'target',
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
