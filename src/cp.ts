import { Message } from './interface';
import { ChildProcess } from 'child_process';
import { AbstractEventBus } from './base';
import * as cluster from 'cluster';
import * as process from 'process';

export class ChildProcessEventBus extends AbstractEventBus<ChildProcess> {
  protected workerSubscribeMessage(
    subscribeMessageHandler: (message: Message) => void
  ) {
    process.on('message', subscribeMessageHandler);
  }

  protected workerListenMessage(
    worker: ChildProcess,
    subscribeMessageHandler: (message: Message) => void
  ) {
    worker.on('message', subscribeMessageHandler);
  }

  protected workerSendMessage(message: Message) {
    process.send(message);
  }

  protected mainSendMessage(worker: ChildProcess, message: Message) {
    worker.send(message);
  }

  isMain() {
    return !this.isWorker();
  }

  isWorker() {
    return this.options.isWorker ?? cluster.isWorker;
  }

  getWorkerId(worker?: ChildProcess): string {
    return String(worker ? worker.pid ?? worker?.['process'].pid : process.pid);
  }
}
