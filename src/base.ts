// event bus
import { EventEmitter, once } from 'events';
import {
  BroadcastOptions,
  EventBusOptions,
  EventCenterMessage,
  IEventBus,
  IResponder,
  ListenerType,
  Message,
  MessageCategory,
  MessageType,
  PublishOptions,
  SubscribeOptions,
  SubscribeTopicListener,
  WaitCheckOptions,
} from './interface';
import { debuglog } from 'util';
import {
  EventBusMainPostError,
  EventBusPublishSpecifyWorkerError,
  EventBusPublishTimeoutError,
  EventBusTimeoutError,
  EventBusWorkerPostError,
} from './error';

const DEFAULT_LISTENER_KEY = '_default_';
const END_FLAG = '\n\n';

function revertError(errorObj: any) {
  const error = new Error();
  error.name = errorObj.name;
  error.message = errorObj.message;
  error.stack = errorObj.stack;
  return error;
}

export async function createWaitHandler(
  checkHandler: () => boolean,
  options: WaitCheckOptions = {}
) {
  await new Promise<boolean>((resolve, reject) => {
    const timeoutHandler = setTimeout(() => {
      clearInterval(handler);
      clearTimeout(timeoutHandler);
      reject(new EventBusTimeoutError());
    }, options.timeout || 5000);

    const handler = setInterval(() => {
      if (checkHandler()) {
        clearInterval(handler);
        clearTimeout(timeoutHandler);
        resolve(true);
      }
    }, options.timeoutCheckInterval || 500);
  });
}

class ChunkIterator<T> implements AsyncIterable<T> {
  private emitter: EventEmitter;
  private buffer = [];
  private readyNext = false;
  private intervalHandler;
  constructor(
    protected readonly options: {
      debugLogger: any;
      chunkPublishBufferCheckInterval?: number;
    }
  ) {
    this.emitter = new EventEmitter();
    this.intervalHandler = setInterval(() => {
      this.options.debugLogger(
        'this.readyNext',
        this.readyNext,
        this.buffer.length
      );
      if (this.readyNext) {
        const data = this.buffer.shift();
        if (data) {
          this.readyNext = false;
          this.options.debugLogger('2 got data and emit iterator', data);
          this.emitter.emit('data', data);
        }
      }
    }, this.options.chunkPublishBufferCheckInterval || 20);
  }
  publish(data) {
    this.buffer.push(data);
  }
  error(err) {
    this.emitter.emit('error', err);
    this.clear();
  }
  [Symbol.asyncIterator](): AsyncIterator<T> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return {
      next(): Promise<IteratorResult<T>> {
        self.options.debugLogger('1 ChunkIterator run next and wait data');
        self.readyNext = true;
        return Promise.resolve(once(self.emitter, 'data')).then(
          ([{ data, isEnd }]) => {
            self.options.debugLogger('3 ChunkIterator get data', data, isEnd);
            if (isEnd) {
              self.clear();
              return { value: undefined, done: true };
            } else {
              return { value: data, done: false };
            }
          }
        );
      },
    };
  }

  clear() {
    this.readyNext = false;
    clearInterval(this.intervalHandler);
    this.emitter.removeAllListeners();
    this.buffer.length = 0;
  }
}

export class AckResponder implements IResponder {
  private isEndFlag = false;
  private dataHandler: (data: unknown) => void;
  private errorHandler: (err: Error) => void;
  public onData(dataHandler: (data: unknown) => void) {
    this.dataHandler = dataHandler;
  }

  public onError(errorHandler: (err: Error) => void) {
    this.errorHandler = errorHandler;
  }

  public end(data?: unknown) {
    if (!this.isEndFlag) {
      this.isEndFlag = true;
      if (data) {
        this.sendData(data);
      }
      this.sendData(END_FLAG);
    }
  }

  protected sendData(data) {
    if (this.dataHandler) {
      this.dataHandler(data);
    }
  }

  public send(data: unknown) {
    if (!this.isEndFlag) {
      this.sendData(data);
    }
  }

  public error(err: Error) {
    if (!this.isEndFlag) {
      if (this.errorHandler) {
        this.errorHandler(err);
      }
    }
  }

  public isEnd() {
    return this.isEndFlag;
  }
}

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

    this.listener = (message, responder?) => {
      const listeners = this.topicListener.get(
        message.messageOptions?.topic || DEFAULT_LISTENER_KEY
      );

      if (listeners) {
        for (const listener of listeners) {
          if (listener['_subscribeOnce']) {
            listeners.delete(listener);
          }
          // eslint-disable-next-line no-async-promise-executor
          new Promise(async (resolve, reject) => {
            try {
              await resolve(listener(message, responder));
            } catch (e) {
              reject(e);
            }
          }).catch(err => {
            if (responder) {
              responder.error(err);
            } else {
              this.eventListenerMap.get(ListenerType.Error)(err);
            }
          });
        }
      } else {
        console.warn(`No listener found, message = ${JSON.stringify(message)}`);
        // 这里可以拿到超时时间，需要的时候可以释放一些定时器
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

  public async start(err?: Error) {
    this.isInited = true;
    if (this.isMain()) {
      await createWaitHandler(() => this.isAllWorkerReady(), {
        timeout: this.options.initTimeout,
        timeoutCheckInterval: this.options.initTimeoutCheckInterval,
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
          error: err
            ? {
                name: err.name,
                message: err.message,
                stack: err.stack,
              }
            : undefined,
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

    if (this.workerReady.size > 0) {
      this.debugLogger(`All worker(size=${this.workerReady.size}) is ready.`);
    }

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
          const isChunk = originMessage.messageOptions?.['isChunk'] === true;
          const responder = new AckResponder();
          responder.onData(data => {
            this.publish(data, {
              relatedMessageId: originMessage.messageId,
              isChunk,
            });

            if (!isChunk) {
              // auto run end in normal invoke mode
              responder.end();
            }
          });

          responder.onError(err => {
            // publish error
            this.publish(err, {
              relatedMessageId: originMessage.messageId,
              isChunk,
            });
            responder.end();
          });

          this.listener?.(originMessage, responder);
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
            const isChunk = originMessage.messageOptions['isChunk'] === true;
            if (asyncResolve) {
              if (!isChunk || (isChunk && originMessage.body === END_FLAG)) {
                this.asyncMessageMap.delete(
                  originMessage.messageOptions.relatedMessageId
                );
              }

              asyncResolve(
                originMessage.error
                  ? revertError(originMessage.error)
                  : undefined,
                originMessage.body,
                isChunk ? originMessage.body === END_FLAG : true
              );
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
            if (originMessage.error) {
              this.debugLogger(
                `got worker ${originMessage.workerId} ready failed`
              );
              this.eventListenerMap.get(ListenerType.Error)(
                revertError(originMessage.error)
              );
            } else {
              this.eventListenerMap.get(ListenerType.Inited)?.(originMessage);
              // got init status from worker
              this.workerReady.get(originMessage.workerId).ready = true;
              this.debugLogger(`got worker ${originMessage.workerId} ready`);
            }
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
    listener: SubscribeTopicListener,
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
    listener: SubscribeTopicListener,
    options: SubscribeOptions = {}
  ) {
    options.subscribeOnce = true;
    this.subscribe(listener, options);
  }

  public publish(
    data: unknown | Error,
    publishOptions: PublishOptions = {}
  ): void {
    if (data instanceof Error) {
      this.transit({
        messageCategory: MessageCategory.OUT,
        message: {
          messageId:
            publishOptions.relatedMessageId || this.generateMessageId(),
          workerId: this.getWorkerId(),
          type: this.isMain() ? MessageType.Request : MessageType.Response,
          body: undefined,
          error: {
            name: data.name,
            message: data.message,
            stack: data.stack,
          },
          messageOptions: publishOptions,
        },
      });
    } else {
      this.transit({
        messageCategory: MessageCategory.OUT,
        message: {
          messageId:
            publishOptions.relatedMessageId || this.generateMessageId(),
          workerId: this.getWorkerId(),
          type: this.isMain() ? MessageType.Request : MessageType.Response,
          body: data,
          messageOptions: publishOptions,
        },
      });
    }
  }

  public publishAsync<ResData>(
    data: unknown,
    publishOptions: PublishOptions = {}
  ): Promise<ResData> {
    return new Promise((resolve, reject) => {
      const messageId =
        publishOptions.relatedMessageId || this.generateMessageId();

      this.useTimeout(messageId, publishOptions.timeout, resolve, reject);

      this.transit({
        messageCategory: MessageCategory.OUT,
        message: {
          messageId,
          workerId: this.getWorkerId(),
          type: this.isMain() ? MessageType.Invoke : MessageType.Response,
          body: data,
          messageOptions: {
            topic: publishOptions.topic,
          },
        },
      });
    });
  }

  public publishChunk<ResData>(
    data: unknown,
    publishOptions: PublishOptions = {}
  ): AsyncIterable<ResData> {
    const messageId =
      publishOptions.relatedMessageId || this.generateMessageId();

    const iterator = new ChunkIterator<ResData>({
      debugLogger: this.debugLogger,
      chunkPublishBufferCheckInterval:
        this.options.publishChunkBufferCheckInterval,
    });

    this.useTimeout(
      messageId,
      publishOptions.timeout,
      (data, isEnd) => {
        iterator.publish({
          data,
          isEnd,
        });
      },
      err => {
        iterator.error(err);
      }
    );

    this.transit({
      messageCategory: MessageCategory.OUT,
      message: {
        messageId,
        workerId: this.getWorkerId(),
        type: this.isMain() ? MessageType.Invoke : MessageType.Response,
        body: data,
        messageOptions: {
          isChunk: true,
          topic: publishOptions.topic,
        },
      },
    });

    return iterator;
  }

  protected useTimeout(
    messageId,
    timeout = 5000,
    successHandler: (data: any, isEnd?: boolean) => void,
    errorHandler: (error: Error) => void
  ) {
    const handler = setTimeout(() => {
      clearTimeout(handler);
      this.asyncMessageMap.delete(messageId);
      errorHandler(new EventBusPublishTimeoutError(messageId));
    }, timeout);

    this.asyncMessageMap.set(messageId, (err, data, isEnd) => {
      if (isEnd || err) {
        clearTimeout(handler);
      }
      if (err) {
        errorHandler(err);
      } else {
        successHandler(data, isEnd);
      }
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
