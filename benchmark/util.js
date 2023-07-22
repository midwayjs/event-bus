const { Worker, SHARE_ENV } = require('worker_threads');
const { fork } = require('child_process');

function createThreadWorker(WORKER_FILE) {
  let w;

  let content = `
    require(${JSON.stringify(WORKER_FILE)});
  `;
  w = new Worker(content, { eval: true, env: SHARE_ENV });
  console.info('new worker thread, threadId = %s.', w.threadId);
  return w;
}

function createChildProcessWorker(WORKER_FILE) {
  return fork(WORKER_FILE, {
    execArgv: []
  });
}

function createLocalWorker(WORKER_FILE) {
  return require(WORKER_FILE);
}

// sleep
function sleep(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  createThreadWorker,
  createChildProcessWorker,
  createLocalWorker,
  sleep,
}
