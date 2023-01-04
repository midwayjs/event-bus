// event bus
import { EventEmitter } from 'events';
import {
  BroadcastOptions,
  EventBusOptions,
  EventCenterMessage,
  IEventBus,
  ListenerType,
  Message,
  MessageCategory,
  MessageType,
  PublishOptions,
  SubscribeOptions,
  SubscribeTopicListener,
} from './interface';
import { debuglog } from 'util';
import {
  EventBusMainPostError,
  EventBusPublishSpecifyWorkerError,
  EventBusPublishTimeoutError,
  EventBusWaitWorkerInitedTimeoutError,
  EventBusWorkerPostError,
} from './error';

const DEFAULT_LISTENER_KEY = '_default_';

export abstract class AbstractEventBus<T> implements IEventBus<T> {
  private isInited = false;
  protected workers: T[] = [];
  protected stopping = false;
  private hub = new EventEmitter();
  protected workerReady = new Map<string, { worker: T; ready: boolean }>();
  private listener: SubscribeTopicListener;
  private topicListener: Map<string, Set<SubscribeTopicListener>> = new Map();
  private asyncMessageMap = new Map<string, any>();
  protected eventListenerMap = new Map<string, any>();
  protected debugLogger = this.createDebugger();

  constructor(protected readonly options: EventBusOptions = {}) {
    this.debugLogger(
      `Start EventBus(${this.constructor.name}) in ${
        this.isWorker() ? 'worker' : 'main'
      }`
    );
    this.eventListenerMap.set(ListenerType.Error, (err: Error) => {
      console.error(err);
    });

    this.listener = (message, callback?) => {
      const listeners = this.topicListener.get(
        message.messageOptions?.topic || DEFAULT_LISTENER_KEY
      );

      if (listeners) {
        for (const listener of listeners) {
          if (listener['_subscribeOnce']) {
            listeners.delete(listener);
          }
          listener(message, callback);
        }
      }
    };

    // bind event center
    this.setupEventBind();
  }

  private createDebugger() {
    return debuglog(
      `midway:event-bus:${this.isWorker() ? 'worker' : 'main  '}`
    );
  }

  private debugDataflow(message: EventCenterMessage) {
    if (message.messageCategory === MessageCategory.IN) {
      if (this.isMain()) {
        return `${message.message.type}|${message.messageCategory}: worker => main(△)`;
      } else {
        return `${message.message.type}|${message.messageCategory}: main => worker(△)`;
      }
    } else {
      if (this.isMain()) {
        return `${message.message.type}|${message.messageCategory}: main(△) => worker`;
      } else {
        return `${message.message.type}|${message.messageCategory}: worker(△) => main`;
      }
    }
  }

  public async start() {
    this.isInited = true;
    if (this.isMain()) {
      await new Promise<boolean>((resolve, reject) => {
        const timeoutHandler = setTimeout(() => {
          clearInterval(handler);
          clearTimeout(timeoutHandler);
          reject(new EventBusWaitWorkerInitedTimeoutError());
        }, this.options.initTimeout || 5000);

        const handler = setInterval(() => {
          if (this.isAllWorkerReady()) {
            clearInterval(handler);
            clearTimeout(timeoutHandler);
            resolve(true);
          }
        }, 200);
      });
    } else {
      // listen main => worker in worker
      this.workerSubscribeMessage((message: Message) => {
        this.transit({
          messageCategory: MessageCategory.IN,
          message,
        });
      });
      // worker => main
      this.transit({
        messageCategory: MessageCategory.OUT,
        message: {
          messageId: this.generateMessageId(),
          workerId: this.getWorkerId(),
          type: MessageType.Inited,
          body: this.isInited,
        },
      });
    }
  }

  public addWorker(worker: T) {
    this.debugLogger(`Add worker(${this.getWorkerId(worker)})`);
    if (!this.workerReady.has(this.getWorkerId(worker))) {
      this.debugLogger(
        `Init worker(${this.getWorkerId(worker)}) status = false`
      );
      this.workerReady.set(this.getWorkerId(worker), {
        worker,
        ready: false,
      });
    } else {
      this.debugLogger(`Skip init worker(${this.getWorkerId(worker)}) status`);
    }
    worker?.['on']('exit', async (exitCode: number) => {
      if (!this.stopping) {
        // remove ready status
        this.workerReady.delete(this.getWorkerId(worker));
        // remove worker
        const idx = this.workers.findIndex(
          item => this.getWorkerId(item) === this.getWorkerId(worker)
        );
        this.workers.splice(idx, 1);
      }
    });

    // listen worker => main in main
    this.workerListenMessage(worker, (message: Message) => {
      this.transit({
        messageCategory: MessageCategory.IN,
        message,
      });
    });

    this.workers.push(worker);
  }

  private isAllWorkerReady() {
    for (const [workerId, value] of this.workerReady) {
      if (!value || !value.ready) {
        this.debugLogger(`Worker(${workerId}) not ready.`);
        return false;
      }
    }
    this.debugLogger(`All worker(size=${this.workerReady.size}) is ready.`);
    return true;
  }

  private setupEventBind() {
    this.hub.on('message', (message: EventCenterMessage) => {
      if (!message.message || !message.message.messageId) {
        // ignore unvalid format message
        return;
      }
      this.debugLogger(
        'EventCenter(%s) message = %j',
        this.debugDataflow(message),
        message
      );
      const originMessage = message.message;
      if (message.messageCategory === MessageCategory.OUT) {
        // out operation
        if (
          originMessage.type === MessageType.Invoke ||
          originMessage.type === MessageType.Request ||
          originMessage.type === MessageType.Response ||
          originMessage.type === MessageType.Broadcast
        ) {
          this.postMessage(originMessage);
          this.eventListenerMap.get(ListenerType.Request)?.(originMessage);
        } else if (originMessage.type === MessageType.Inited) {
          this.postMessage(originMessage);
          this.eventListenerMap.get(ListenerType.Inited)?.(originMessage);
        }
      } else if (message.messageCategory === MessageCategory.IN) {
        // in operation
        if (originMessage.type === MessageType.Invoke) {
          this.listener?.(originMessage, data => {
            this.publish(data, {
              relatedMessageId: originMessage.messageId,
            });
          });
          this.eventListenerMap.get(ListenerType.Subscribe)?.(originMessage);
        } else if (originMessage.type === MessageType.Request) {
          this.listener?.(originMessage);
          this.eventListenerMap.get(ListenerType.Subscribe)?.(originMessage);
        } else if (originMessage.type === MessageType.Broadcast) {
          if (this.isMain()) {
            if (
              originMessage.messageOptions['includeMainFromWorker'] === true
            ) {
              this.listener?.(originMessage);
              this.eventListenerMap.get(ListenerType.Subscribe)?.(
                originMessage
              );
            }
            this.broadcast(originMessage.body, {
              ...originMessage.messageOptions,
              relatedMessageId: originMessage.messageId,
              relatedWorkerId: originMessage.workerId,
            });
          } else {
            this.listener?.(originMessage);
            this.eventListenerMap.get(ListenerType.Subscribe)?.(originMessage);
          }
        } else if (originMessage.type === MessageType.Response) {
          if (originMessage.messageOptions?.relatedMessageId) {
            // worker => main with invoke
            const asyncResolve = this.asyncMessageMap.get(
              originMessage.messageOptions.relatedMessageId
            );
            if (asyncResolve) {
              this.asyncMessageMap.delete(
                originMessage.messageOptions.relatedMessageId
              );
              asyncResolve(originMessage.body);
            } else {
              // not found and ignore
            }
          } else {
            this.listener?.(originMessage);
            this.eventListenerMap.get(ListenerType.Subscribe)?.(originMessage);
          }
        } else if (originMessage.type === MessageType.Inited) {
          if (this.isMain()) {
            // trigger in worker
            this.eventListenerMap.get(ListenerType.Inited)?.(originMessage);
            // got init status from worker
            this.workerReady.get(originMessage.workerId).ready = true;
            this.debugLogger(`got worker ${originMessage.workerId} ready`);
          } else {
            // ignore
          }
        }
      }
    });
  }

  protected transit(message: EventCenterMessage) {
    this.hub.emit('message', message);
  }

  public subscribe(
    listener: (message: Message, callback?: (data: any) => void) => void,
    options: SubscribeOptions = {}
  ) {
    if (!this.topicListener.has(options.topic)) {
      this.topicListener.set(options.topic || DEFAULT_LISTENER_KEY, new Set());
    }
    if (options.subscribeOnce) {
      listener['_subscribeOnce'] = true;
    }
    this.topicListener.get(options.topic || DEFAULT_LISTENER_KEY).add(listener);
  }

  public subscribeOnce(
    listener: (message: Message, callback?: (data: any) => void) => void,
    options: SubscribeOptions = {}
  ) {
    options.subscribeOnce = true;
    this.subscribe(listener, options);
  }

  public publish(data: unknown, publishOptions: PublishOptions = {}): void {
    this.transit({
      messageCategory: MessageCategory.OUT,
      message: {
        messageId: publishOptions.relatedMessageId || this.generateMessageId(),
        workerId: this.getWorkerId(),
        type: this.isMain() ? MessageType.Request : MessageType.Response,
        body: data,
        messageOptions: publishOptions,
      },
    });
  }

  public publishAsync(
    data: unknown,
    publishOptions: PublishOptions = {}
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId =
        publishOptions.relatedMessageId || this.generateMessageId();

      const handler = setTimeout(() => {
        clearTimeout(handler);
        this.asyncMessageMap.delete(messageId);
        reject(new EventBusPublishTimeoutError(messageId));
      }, publishOptions.timeout || 5000);

      this.asyncMessageMap.set(messageId, data => {
        clearTimeout(handler);
        resolve(data);
      });

      this.transit({
        messageCategory: MessageCategory.OUT,
        message: {
          messageId,
          workerId: this.getWorkerId(),
          type: this.isMain() ? MessageType.Invoke : MessageType.Response,
          body: data,
        },
      });
    });
  }

  public broadcast(data: unknown, options: BroadcastOptions = {}) {
    if (this.isWorker()) {
      options = {
        includeMainFromWorker: false,
        includeSelfFromWorker: false,
        ...options,
      };
    }
    this.transit({
      messageCategory: MessageCategory.OUT,
      message: {
        messageId: options.relatedMessageId || this.generateMessageId(),
        workerId: this.getWorkerId(),
        type: MessageType.Broadcast,
        body: data,
        messageOptions: options,
      },
    });
  }

  protected postMessage(message: Message) {
    if (this.isMain()) {
      if (this.workers.length > 0) {
        if (message.type === MessageType.Broadcast) {
          if (
            message.messageOptions &&
            message.messageOptions['relatedWorkerId']
          ) {
            this.workers.forEach(w => {
              if (
                message.messageOptions['includeSelfFromWorker'] === false &&
                this.getWorkerId(w) ===
                  message.messageOptions['relatedWorkerId']
              ) {
                return;
              } else {
                this.mainSendMessage(w, message);
              }
            });
          } else {
            this.workers.forEach(w => this.mainSendMessage(w, message));
          }
        } else if (message.messageOptions?.['targetWorkerId']) {
          const targetWorker = this.workerReady.get(
            message.messageOptions?.['targetWorkerId']
          )?.worker;
          if (!targetWorker) {
            throw new EventBusPublishSpecifyWorkerError(
              message.messageOptions?.['targetWorkerId']
            );
          }
          this.mainSendMessage(targetWorker, message);
        } else {
          // round ring
          const [worker, ...otherWorkers] = this.workers;
          try {
            this.mainSendMessage(worker, message);
          } catch (err) {
            this.eventListenerMap.get(ListenerType.Error)?.(
              new EventBusMainPostError(message, err)
            );
          }
          this.workers = [...otherWorkers, worker];
        }
      }
    } else {
      try {
        this.workerSendMessage(message);
      } catch (err) {
        this.eventListenerMap.get(ListenerType.Error)?.(
          new EventBusWorkerPostError(message, err)
        );
      }
    }
  }

  protected abstract workerSubscribeMessage(
    subscribeMessageHandler: (message: Message) => void
  );
  protected abstract workerListenMessage(
    worker: T,
    subscribeMessageHandler: (message: Message) => void
  );
  protected abstract workerSendMessage(message: Message);
  protected abstract mainSendMessage(worker: T, message: Message);
  public abstract isMain();
  public abstract isWorker();
  public abstract getWorkerId(worker?: T): string;

  public onInited(listener: (message: Message<unknown>) => void) {
    this.eventListenerMap.set(ListenerType.Inited, listener);
  }

  public onPublish(listener: (message: Message<unknown>) => void) {
    this.eventListenerMap.set(ListenerType.Request, listener);
  }

  public onSubscribe(listener: (message: Message<unknown>) => void) {
    this.eventListenerMap.set(ListenerType.Subscribe, listener);
  }

  public onError(listener: (error: Error) => void) {
    this.eventListenerMap.set(ListenerType.Error, listener);
  }

  public async stop(): Promise<void> {
    this.stopping = true;
    this.hub.removeAllListeners();
    this.workerReady.clear();
    this.eventListenerMap.clear();
    this.listener = null;
    this.workers.length = 0;
  }

  generateMessageId() {
    return Math.random().toString(36).substring(2);
  }
}
