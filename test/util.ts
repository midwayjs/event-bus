import { extname } from 'path';
import { Worker, SHARE_ENV } from 'worker_threads';
import { ChildProcess, fork } from 'child_process';

export function createThreadWorker(WORKER_FILE): Worker {
  let w: Worker;

  let content = `
    require(${JSON.stringify(WORKER_FILE)});
  `;
  // 当前是 ts 环境
  if (extname(WORKER_FILE) === '.ts') {
    content = `
    require("ts-node/register/transpile-only");
    ${content}
    `;

    w = new Worker(content, { eval: true, env: SHARE_ENV });
    console.info(
      'new worker thread with ts-node, threadId = %s.',
      w.threadId
    );
  } else {
    w = new Worker(content, { eval: true, env: SHARE_ENV });
    console.info('new worker thread, threadId = %s.', w.threadId);
  }

  return w;
}

export function createChildProcessWorker(WORKER_FILE): ChildProcess {
  return fork(WORKER_FILE, {
    execArgv: [
      '--require',
      'ts-node/register/transpile-only',
    ]
  });
}

export function createLocalWorker(WORKER_FILE) {
  return require(WORKER_FILE);
}

// sleep
export function sleep(ms: number = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
