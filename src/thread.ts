import { Message } from './interface';
import { Worker, threadId, isMainThread, parentPort } from 'worker_threads';
import { AbstractEventBus } from './base';

export class ThreadEventBus extends AbstractEventBus<Worker> {
  protected workerSubscribeMessage(
    subscribeMessageHandler: (message: Message) => void
  ) {
    parentPort.on('message', subscribeMessageHandler);
  }

  protected workerListenMessage(
    worker: Worker,
    subscribeMessageHandler: (message: Message) => void
  ) {
    worker.on('message', subscribeMessageHandler);
  }

  protected workerSendMessage(message: Message) {
    parentPort.postMessage(message);
  }

  protected mainSendMessage(worker: Worker, message: Message) {
    worker.postMessage(message);
  }

  isMain() {
    return isMainThread;
  }

  isWorker() {
    return this.options.isWorker ?? !isMainThread;
  }

  getWorkerId(worker?: Worker) {
    return worker ? worker.threadId : threadId;
  }
}
