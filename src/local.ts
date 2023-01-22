import { AbstractEventBus, createWaitHandler } from './base';
import { LocalEventBusOptions, Message } from './interface';

class LocalDispatcher {
  private pidIdx = 0;
  mainWorker: LocalWorker;
  childWorker: LocalWorker;
  initMessageQueue = [];
  clear() {
    this.mainWorker = null;
    this.childWorker = null;
    this.pidIdx = 0;
  }

  generatePid() {
    return this.pidIdx++;
  }
}

const dispatcher = new LocalDispatcher();

class LocalWorker {
  handler;
  constructor(protected pid: number) {}

  onMessage(handler: (message: Message) => void) {
    this.handler = handler;
  }

  on() {
    // ignore exit event
  }

  public getWorkerId() {
    return this.pid;
  }

  terminate() {}
}

export class LocalEventBus extends AbstractEventBus<LocalWorker> {
  private worker: LocalWorker = new LocalWorker(dispatcher.generatePid());
  protected options: LocalEventBusOptions;

  constructor(options: LocalEventBusOptions = {}) {
    super(options);
    if (this.isMain()) {
      this.debugLogger(`Main id=${this.worker.getWorkerId()}`);
      dispatcher.mainWorker = this.worker;
    } else {
      this.debugLogger(`Child id=${this.worker.getWorkerId()}`);
      dispatcher.childWorker = this.worker;
    }
  }

  protected workerSubscribeMessage(
    subscribeMessageHandler: (message: Message) => void
  ) {
    if (this.isWorker()) {
      dispatcher.childWorker.onMessage(subscribeMessageHandler);
    }
  }

  protected workerListenMessage(
    worker: any,
    subscribeMessageHandler: (message: Message) => void
  ) {
    if (this.isMain()) {
      dispatcher.mainWorker.onMessage(subscribeMessageHandler);
    }
  }

  protected workerSendMessage(message: Message) {
    // worker to main
    if (dispatcher.mainWorker.handler) {
      dispatcher.mainWorker.handler(message);
    } else {
      dispatcher.initMessageQueue.push({
        to: 'main',
        message,
      });
    }
  }

  protected mainSendMessage(worker: any, message: Message) {
    // main to worker
    if (dispatcher.childWorker.handler) {
      dispatcher.childWorker.handler(message);
    } else {
      dispatcher.initMessageQueue.push({
        to: 'worker',
        message,
      });
    }
  }

  getWorkerId(worker?: any): string {
    return String((worker || this.worker).getWorkerId());
  }

  isMain(): boolean {
    return !this.isWorker();
  }

  isWorker(): boolean {
    return this.options.isWorker;
  }

  async start(err?: Error) {
    if (this.isMain()) {
      await createWaitHandler(() => dispatcher.childWorker != null, {
        timeout: this.options.waitWorkerTimeout,
        timeoutCheckInterval: this.options.waitWorkerCheckInterval || 200,
      });
      this.addWorker(dispatcher.childWorker);
      if (dispatcher.initMessageQueue.length) {
        dispatcher.initMessageQueue.forEach(({ to, message }) => {
          if (to === 'worker') {
            this.mainSendMessage(dispatcher.childWorker, message);
          } else {
            this.workerSendMessage(message);
          }
        });
        dispatcher.initMessageQueue = [];
      }
    }
    await super.start(err);
  }

  async stop() {
    dispatcher.clear();
    await super.stop();
  }
}
