import { LocalEventBus } from '../../src/index';

export async function createWorker() {
  const bus = new LocalEventBus({
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
