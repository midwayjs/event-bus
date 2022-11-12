import { ChildProcessEventBus } from '../../src';

async function createWorker() {
  const bus = new ChildProcessEventBus({
    isWorker: true,
  });

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
