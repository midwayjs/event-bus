import { ThreadEventBus } from '../../src';

async function createWorker() {
  const bus = new ThreadEventBus({
    isWorker: true,
  });

  await bus.start();

  try {
    // 设置较短的超时时间
    await bus.publishAsync<{data: string}>({
      data: 'request from child',
    }, {
      timeout: 1000  // 1秒超时
    });
  } catch (err) {
    // 发送超时错误给主进程以验证
    bus.publish({
      error: {
        message: err.message
      }
    });
  }
}

createWorker().then(() => {
  console.log('Thread worker is ready');
});
