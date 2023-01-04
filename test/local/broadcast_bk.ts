import { LocalEventBus } from '../../src/index';
import { sleep } from '../util';

async function createWorker() {
  const bus = new LocalEventBus({
    isWorker: true,
  });

  bus.subscribe(message=>{
    console.log(message);

    bus.publish({
      data: 'hello world'
    });
  });
  await sleep();
  await bus.start();
}

createWorker().then(() => {
  console.log('ready');
});
