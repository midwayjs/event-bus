import { ChildProcessEventBus } from '../../src';

async function createWorker() {
  const bus = new ChildProcessEventBus({
    isWorker: true,
  });

  await bus.start();

  // 在子进程中发送异步消息到主进程
  const result = await bus.publishAsync<{data: string}>({
    data: 'request from child',
  });

  if (result.data === 'response from main') {
    bus.publish({
      data: 'ok',
    });
  }
}

createWorker().then(() => {
  console.log('Child process is ready');
});
