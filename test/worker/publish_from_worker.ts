import { ThreadEventBus } from '../../src/index';

export async function createWorker() {
  const bus = new ThreadEventBus({
    isWorker: true,
  });

  await bus.start();
  bus.publish({
    data: 'hello world'
  });
}

createWorker().then(() => {
  console.log('ready');
});
