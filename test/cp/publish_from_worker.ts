import { ChildProcessEventBus } from '../../src/index';

export async function createWorker() {
  const bus = new ChildProcessEventBus({
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
