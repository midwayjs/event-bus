import { ThreadEventBus } from '../../src/index';

async function createWorker() {
  const bus = new ThreadEventBus();

  bus.subscribe(message=>{
    console.log(message);

    bus.publish({
      data: 'hello world'
    });
  });

  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});