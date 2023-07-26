import { Message, ThreadEventBusOptions } from './interface';
import { Worker, threadId, isMainThread, parentPort } from 'worker_threads';
import { AbstractEventBus } from './base';

export class ThreadEventBus extends AbstractEventBus<Worker> {
  protected options: ThreadEventBusOptions;
  constructor(options: ThreadEventBusOptions = {}) {
    super(options);
    if (!this.options.requestEncoder) {
      this.options.requestEncoder = message => {
        return message;
      };
    }

    if (!this.options.requestDecoder) {
      this.options.requestDecoder = serializedData => {
        return serializedData;
      };
    }
  }
  protected workerSubscribeMessage(
    subscribeMessageHandler: (message: Message) => void
  ) {
    parentPort.on('message', subscribeMessageHandler);
  }

  protected workerListenMessage(
    worker: Worker,
    subscribeMessageHandler: (message: Message) => void
  ) {
    worker.on('message', serializedData => {
      subscribeMessageHandler(this.options.requestDecoder(serializedData));
    });
  }

  protected workerSendMessage(message: Message) {
    parentPort.postMessage(message);
  }

  protected mainSendMessage(worker: Worker, message: Message) {
    worker.postMessage(this.options.requestEncoder(message));
  }

  isMain() {
    return !this.isWorker();
  }

  isWorker() {
    return this.options.isWorker ?? !isMainThread;
  }

  getWorkerId(worker?: Worker): string {
    return String(worker ? worker.threadId : threadId);
  }
}
