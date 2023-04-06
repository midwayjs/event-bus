import { join } from 'path';
import { createLocalWorker } from './util';
import { LocalEventBus } from '../src';

describe('/test/local.test.ts', function () {

  it('test init error', async () => {
    const bus = new LocalEventBus();
    createLocalWorker(join(__dirname, 'local/init_error.ts'));
    const error = await new Promise<Error>((resolve, reject) => {
      bus.onError(err => {
        resolve(err);
      });

      bus.start();
    });

    expect(error).toBeDefined();
    expect(error.name).toEqual('CustomError');
    expect(error.message).toMatch('custom error');

    await bus.stop();
  });

  it('test base publish and subscribe', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    createLocalWorker(join(__dirname, 'local/base.ts'));
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

    await bus.stop();
  });

  it('test publish with async', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    createLocalWorker(join(__dirname, 'local/publish_async.ts'));
    await bus.start();

    const result = await bus.publishAsync({
      data: {
        name: 'test',
      }
    });

    expect(result).toEqual({ data: 'hello world' });

    await bus.stop();
  });

  it('test publish with async and throw error', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    createLocalWorker(join(__dirname, 'local/publish_async_error.ts'));
    await bus.start();

    let error;
    try {
      await bus.publishAsync({
        data: {
          name: 'test',
        }
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.name).toEqual('CustomError');
    expect(error.message).toMatch('custom error');

    await bus.stop();
  });

  it('test publish async with timeout error', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    createLocalWorker(join(__dirname, 'local/publish_async_timeout.ts'));
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

    await bus.stop();
  });

  it('test broadcast', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    let total = 0;

    createLocalWorker(join(__dirname, 'local/broadcast.ts'));
    await bus.start();

    await new Promise<void>(resolve => {
      bus.subscribe(message => {
        total++;
        if (total === 1) {
          resolve();
        }
      });

      bus.broadcast({
        data: {
          name: 'test',
        }
      });
    })

    await bus.stop();
  });

  it('test broadcast without self no effect for main thread', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    let total = 0;

    createLocalWorker(join(__dirname, 'local/broadcast_bk.ts'));
    await bus.start();

    await new Promise<void>(resolve => {
      bus.subscribe(message => {
        total++;
        if (total === 1) {
          resolve();
        }
      });

      bus.broadcast({
        data: {
          name: 'test',
        }
      },{
        includeSelfFromWorker: true,
        includeMainFromWorker: true,
      });
    })

    await bus.stop();
  });

  it('test broadcast from worker and trigger with self', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    let total = 0;

    createLocalWorker(join(__dirname, 'local/broadcast_worker.ts'));
    await bus.start();

    await new Promise<void>((resolve, reject) => {
      bus.subscribe(message => {
        if (message.body === 'got it') {
          total++;
          console.log(total);
          if (total === 1) {
            resolve();
          }
        }
      });

      bus.publish('just you');
    });

    await bus.stop();
  });

  it('test broadcast from worker and without self worker', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    let total = 0;

    createLocalWorker(join(__dirname, 'local/broadcast_worker_without_self.ts'));
    await bus.start();

    let error;
    try {
      await new Promise<void>((resolve, reject) => {

        setTimeout(() => {
          reject('timeout');
        }, 2000);

        bus.subscribe(message => {
          if (message.body === 'got it') {
            total++;
            if (total === 1) {
              resolve();
            }
          } else if (message.body === 'fail') {
            reject(new Error('fail'));
          }
        });

        bus.publish('just you');
      })
    } catch (err) {
      error = err;
    }

    expect(error).toEqual('timeout');

    await bus.stop();
  });

  it('test broadcast from worker and trigger in main', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    let total = 0;

    createLocalWorker(join(__dirname, 'local/broadcast_worker_with_main.ts'));
    await bus.start();

    await new Promise<void>((resolve, reject) => {
      bus.subscribe(message => {
        if (message.body === 'got it' || message.body.data === 'hello world') {
          total++;
          if (total === 1) {
            resolve();
          }
        } else if (message.body === 'fail') {
          reject(new Error('fail'));
        }
      });

      bus.publish('just you');
    })
    await bus.stop();
  });

  describe('test chunk', function () {
    it('test publish chunk and run end', async () => {
      const bus = new LocalEventBus({
        isWorker: false,
      });
      createLocalWorker(join(__dirname, 'local/publish_chunk.ts'));
      await bus.start();

      const iterator = bus.publishChunk<string>({
        data: {
          name: 'test',
        }
      });

      let result = [];
      for await (const data of iterator) {
        result.push(data);
      }

      expect(result.join('')).toEqual('hello world');

      await bus.stop();
    });

    it('should publish chunk with topic', async () => {
      const bus = new LocalEventBus({
        isWorker: false,
      });
      createLocalWorker(join(__dirname, 'local/publish_chunk_topic.ts'));
      await bus.start();

      const iterator = bus.publishChunk<string>({
        data: {
          name: 'test',
        }
      }, {
        topic: 'in-request'
      });

      let result = [];
      for await (const data of iterator) {
        result.push(data);
      }

      expect(result.join('')).toEqual('hello world');

      await bus.stop();
    });

    it('test publish chunk and run end with data', async () => {
      const bus = new LocalEventBus({
        isWorker: false,
      });
      createLocalWorker(join(__dirname, 'local/publish_chunk_end_data.ts'));
      await bus.start();

      const iterator = bus.publishChunk<string>({
        data: {
          name: 'test',
        }
      });

      let result = [];
      for await (const data of iterator) {
        result.push(data);
      }

      expect(result.join('')).toEqual('hello world');

      await bus.stop();
    });

    it('test publish chunk timeout', async () => {
      const bus = new LocalEventBus({
        isWorker: false,
      });
      createLocalWorker(join(__dirname, 'local/publish_chunk_timeout.ts'));
      await bus.start();

      let error;
      try {
        const iterator = bus.publishChunk<string>({
          data: {
            name: 'test',
          },
        }, {
          timeout: 1000
        });

        let result = [];
        for await (const data of iterator) {
          result.push(data);
        }
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toMatch('timeout');

      await bus.stop();
    });

    it('test publish chunk and worker throw error', async () => {
      const bus = new LocalEventBus({
        isWorker: false,
      });
      createLocalWorker(join(__dirname, 'local/publish_chunk_worker_error.ts'));
      await bus.start();

      const iterator = bus.publishChunk<string>({
        data: {
          name: 'test',
        },
      });

      let error;
      try {
        let result = [];
        for await (const data of iterator) {
          result.push(data);
        }
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.name).toEqual('CustomError');
      expect(error.message).toMatch('custom error');

      await bus.stop();
    });
  });

  it('test publish from worker', async () => {
    const bus = new LocalEventBus({
      isWorker: false,
    });
    createLocalWorker(join(__dirname, 'local/publish_from_worker.ts'));
    await bus.start();

    const result = await new Promise(resolve => {
      bus.subscribe(message => {
        resolve(message.body);
      });
    });

    expect(result).toEqual({ data: 'hello world' });

    await bus.stop();
  });
});
