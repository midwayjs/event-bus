import { AbstractEventBus } from './base';
import { EventBusOptions, Message } from './interface';

class LocalDispatcher {
  private pidIdx = 0;
  mainWorker: LocalWorker;
  childWorker: LocalWorker;
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

  constructor(options: EventBusOptions = {}) {
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
    } else {
      dispatcher.mainWorker.onMessage(subscribeMessageHandler);
    }
  }

  protected workerListenMessage(
    worker: any,
    subscribeMessageHandler: (message: Message) => void
  ) {
    if (this.isWorker()) {
      dispatcher.childWorker.onMessage(subscribeMessageHandler);
    } else {
      dispatcher.mainWorker.onMessage(subscribeMessageHandler);
    }
  }

  protected workerSendMessage(message: Message) {
    dispatcher.mainWorker.handler(message);
  }

  protected mainSendMessage(worker: any, message: Message) {
    dispatcher.childWorker.handler(message);
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

  async start() {
    if (this.isMain()) {
      this.addWorker(dispatcher.childWorker);
    }
    await super.start();
  }

  async stop() {
    dispatcher.clear();
    await super.stop();
  }
}
