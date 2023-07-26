import { Message, ThreadEventBusOptions } from './interface';
import { Worker, threadId, isMainThread, parentPort } from 'worker_threads';
import { AbstractEventBus } from './base';

export class ThreadEventBus extends AbstractEventBus<Worker> {
  protected options: ThreadEventBusOptions;
  constructor(options: ThreadEventBusOptions = {}) {
    super(options);
    if (!this.options.encoder) {
      this.options.encoder = message => {
        return message;
      };
    }

    if (!this.options.decoder) {
      this.options.decoder = serializedData => {
        return serializedData;
      };
    }
  }
  protected workerSubscribeMessage(
    subscribeMessageHandler: (message: Message) => void
  ) {
    parentPort.on('message', (serializedData: any) => {
      subscribeMessageHandler(this.options.decoder(serializedData));
    });
  }

  protected workerListenMessage(
    worker: Worker,
    subscribeMessageHandler: (message: Message) => void
  ) {
    worker.on('message', serializedData => {
      subscribeMessageHandler(this.options.decoder(serializedData));
    });
  }

  protected workerSendMessage(message: Message) {
    parentPort.postMessage(this.options.encoder(message));
  }

  protected mainSendMessage(worker: Worker, message: Message) {
    worker.postMessage(this.options.encoder(message));
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
