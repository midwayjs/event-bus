const Benchmark = require('benchmark');
const { createThreadWorker, createLocalWorker, createChildProcessWorker } = require('./util');
const { ThreadEventBus, LocalEventBus, ChildProcessEventBus } = require('../dist');
const assert = require('assert');
const { join } = require('path');
const suite = new Benchmark.Suite();

let threadBus, localBus, childProcessBus;

async function createThread(workerNum) {
  const bus = new ThreadEventBus();
  const workerList = [];

  async function close() {
    for (let i = 0; i < workerList.length; i++) {
      await workerList[i].terminate();
    }
    await bus.stop();
  }

  for (let i = 0; i < workerNum; i++) {
    const worker = createThreadWorker(join(__dirname, 'child_thread.js'));
    bus.addWorker(worker);
    workerList.push(worker);
  }
  await bus.start();
  threadBus = bus;

  const result = await bus.publishAsync({
    data: {
      name: 'test',
    }
  });

  assert(result.body.data.name === 'test');

  return close;
}

async function createLocal() {
  const bus = new LocalEventBus({
    isWorker: false,
  });
  createLocalWorker(join(__dirname, 'child_local.js'));
  await bus.start();

  localBus = bus;

  const result = await bus.publishAsync({
    data: {
      name: 'test',
    }
  });

  assert(result.body.data.name === 'test');
}

async function createChildProcess(workerNum) {
  const bus = new ChildProcessEventBus({
    isWorker: false,
  });

  const workerList = [];

  async function close() {
    for (let i = 0; i < workerList.length; i++) {
      await workerList[i].kill();
    }
    await bus.stop();
  }

  for (let i = 0; i < workerNum; i++) {
    const worker = createChildProcessWorker(join(__dirname, 'child_cp.js'));
    bus.addWorker(worker);
    workerList.push(worker);
  }
  await bus.start();
  childProcessBus = bus;

  const result = await bus.publishAsync({
    data: {
      name: 'test',
    }
  });

  assert(result.body.data.name === 'test');

  return close;
}

(async () => {
  await createLocal();
  const closeThreadProcess = await createThread(4);
  const closeChildProcess = await createChildProcess(4);

  await new Promise(resolve => {
    suite
    .add("local", {
      defer: true,
      minSamples: 100,
      fn: async function(deferred) {
        const result = await localBus.publishAsync(require('./data'));
        assert(result.body.url);
        deferred.resolve();
      }
    })
    .add("child_process", {
      defer: true,
      minSamples: 100,
      fn: async function(deferred) {
        const result = await childProcessBus.publishAsync(require('./data'));
        assert(result.body.url);
        deferred.resolve();
      }
    })
    .add("thread", {
      minSamples: 100,
      defer: true,
      fn: async function(deferred) {
        const result = await threadBus.publishAsync(require('./data'));
        assert(result.body.url);
        deferred.resolve();
      }
    })
    .on("cycle", function(event) {
      console.log(String(event.target));
    })
    .on("complete", function() {
      console.log("Fastest is " + this.filter("fastest").map("name"));
      resolve();
    })
    .run({ async: true });
  })


  await localBus.stop();
  await closeThreadProcess();
  await closeChildProcess();
})()
