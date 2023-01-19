import { join } from 'path';
import { createThreadWorker } from './util';
import { ThreadEventBus } from '../src';

describe('/test/thread.test.ts', function () {
  it('test base thread publish and subscribe', async () => {
    const bus = new ThreadEventBus();
    const worker = createThreadWorker(join(__dirname, 'worker/base.ts'));
    bus.addWorker(worker);
    await bus.start();

    const result = await new Promise(resolve => {
      bus.subscribe(message => {
        resolve(message.body);
      });

      bus.publish({
        data: {
          name: 'test',
        }
      },
      {
        topic: 'target',
      });
    });

    expect(result).toEqual({ data: 'hello world' });

    await worker.terminate();
    await bus.stop();
  });

  it('test publish with async', async () => {
    const bus = new ThreadEventBus();
    const worker = createThreadWorker(join(__dirname, 'worker/publish_async.ts'));
    bus.addWorker(worker);
    await bus.start();

    const result = await bus.publishAsync({
      data: {
        name: 'test',
      }
    });

    expect(result).toEqual({ data: 'hello world' });

    await worker.terminate();
    await bus.stop();
  });

  it('test publish async with timeout error', async () => {
    const bus = new ThreadEventBus();
    const worker = createThreadWorker(join(__dirname, 'worker/publish_async_timeout.ts'));
    bus.addWorker(worker);
    await bus.start();

    let error;
    try {
      await bus.publishAsync({
        data: {
          name: 'test',
        },
      }, {
        timeout: 1000,
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.message).toMatch('timeout');

    await worker.terminate();
    await bus.stop();
  });

  it('test broadcast', async () => {
    const bus = new ThreadEventBus();
    let total = 0;

    const worker1 = createThreadWorker(join(__dirname, 'worker/broadcast.ts'));
    const worker2 = createThreadWorker(join(__dirname, 'worker/broadcast.ts'));
    const worker3 = createThreadWorker(join(__dirname, 'worker/broadcast.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    await new Promise<void>(resolve => {
      bus.subscribe(message => {
        total++;
        if (total === 3) {
          resolve();
        }
      });

      bus.broadcast({
        data: {
          name: 'test',
        }
      });
    })

    await worker1.terminate();
    await worker2.terminate();
    await worker3.terminate();
    await bus.stop();
  });

  it('test broadcast without self no effect for main thread', async () => {
    const bus = new ThreadEventBus();
    let total = 0;

    const worker1 = createThreadWorker(join(__dirname, 'worker/broadcast.ts'));
    const worker2 = createThreadWorker(join(__dirname, 'worker/broadcast.ts'));
    const worker3 = createThreadWorker(join(__dirname, 'worker/broadcast.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    await new Promise<void>(resolve => {
      bus.subscribe(message => {
        total++;
        if (total === 3) {
          resolve();
        }
      });

      bus.broadcast({
        data: {
          name: 'test',
        }
      }, {
        includeSelfFromWorker: true,
        includeMainFromWorker: true,
      });
    })

    await worker1.terminate();
    await worker2.terminate();
    await worker3.terminate();
    await bus.stop();
  });

  it('test broadcast from worker and trigger with self', async () => {
    const bus = new ThreadEventBus();
    let total = 0;

    const worker1 = createThreadWorker(join(__dirname, 'worker/broadcast_worker.ts'));
    const worker2 = createThreadWorker(join(__dirname, 'worker/broadcast_worker.ts'));
    const worker3 = createThreadWorker(join(__dirname, 'worker/broadcast_worker.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    bus.publish('just you');

    await new Promise<void>((resolve, reject) => {
      bus.subscribe(message => {
        if (message.body === 'got it') {
          total++;
          console.log(total);
          if (total === 3) {
            resolve();
          }
        }
      });
    })

    await worker1.terminate();
    await worker2.terminate();
    await worker3.terminate();
    await bus.stop();
  });

  it('test broadcast from worker and without self worker', async () => {
    const bus = new ThreadEventBus();
    let total = 0;

    const worker1 = createThreadWorker(join(__dirname, 'worker/broadcast_worker_without_self.ts'));
    const worker2 = createThreadWorker(join(__dirname, 'worker/broadcast_worker_without_self.ts'));
    const worker3 = createThreadWorker(join(__dirname, 'worker/broadcast_worker_without_self.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    bus.publish('just you');

    await new Promise<void>((resolve, reject) => {
      bus.subscribe(message => {
        if (message.body === 'got it') {
          total++;
          if (total === 2) {
            resolve();
          }
        } else if (message.body === 'fail') {
          reject(new Error('fail'));
        }
      });
    })

    await worker1.terminate();
    await worker2.terminate();
    await worker3.terminate();
    await bus.stop();
  });

  it('test broadcast from worker and trigger in main', async () => {
    const bus = new ThreadEventBus();
    let total = 0;

    const worker1 = createThreadWorker(join(__dirname, 'worker/broadcast_worker_with_main.ts'));
    const worker2 = createThreadWorker(join(__dirname, 'worker/broadcast_worker_with_main.ts'));
    const worker3 = createThreadWorker(join(__dirname, 'worker/broadcast_worker_with_main.ts'));
    bus.addWorker(worker1);
    bus.addWorker(worker2);
    bus.addWorker(worker3);

    await bus.start();

    bus.publish('just you');

    await new Promise<void>((resolve, reject) => {
      bus.subscribe(message => {
        if (message.body === 'got it' || message.body.data === 'hello world') {
          total++;
          if (total === 3) {
            resolve();
          }
        } else if (message.body === 'fail') {
          reject(new Error('fail'));
        }
      });
    })

    await worker1.terminate();
    await worker2.terminate();
    await worker3.terminate();
    await bus.stop();
  });

  it('test publish chunk and run end', async () => {
    const bus = new ThreadEventBus();
    const worker = createThreadWorker(join(__dirname, 'worker/publish_chunk.ts'));
    bus.addWorker(worker);
    await bus.start();

    const collector = await bus.publishChunk({
      data: {
        name: 'test',
      }
    });

    const result = await new Promise((resolve, reject) => {
      let result = [];
      collector.onData(data => {
        result.push(data);
      });
      collector.onEnd(() => {
        resolve(result.join(''));
      });
    });

    expect(result).toEqual('hello world');

    await worker.terminate();
    await bus.stop();
  });
});
