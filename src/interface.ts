export enum MessageType {
  /**
   * worker => main
   */
  Inited = 'inited',
  /**
   * main => worker
   */
  Request = 'request',
  /**
   * worker => main
   */
  Response = 'response',
  Invoke = 'invoke',
  Broadcast = 'broadcast',
}

export enum ListenerType {
  Inited = 'inited',
  Request = 'request',
  Subscribe = 'Subscribe',
  WorkerChanged = 'worker_changed',
  Error = 'error',
}

export enum MessageCategory {
  IN = 'in',
  OUT = 'out',
}

export type Message<BODY = any> = {
  messageId: string;
  workerId: string;
  type: MessageType;
  error?: { stack: string };
  body: BODY;
  messageOptions?: PublishOptions | BroadcastOptions;
};

export type EventCenterMessage = {
  messageCategory: MessageCategory;
  message: Message;
};

export interface EventBusOptions {
  initTimeout?: number;
  initTimeoutCheckInterval?: number;
  isWorker?: boolean;
}

export interface LocalEventBusOptions extends EventBusOptions {
  waitWorkerTimeout?: number;
  waitWorkerCheckInterval?: number;
}

export interface WaitCheckOptions {
  timeout?: number;
  timeoutCheckInterval?: number;
  ErrorClz?: new (...args) => Error;
}

export interface PublishOptions {
  timeout?: number;
  relatedMessageId?: string;
  targetWorkerId?: string;
  topic?: string;
}

export interface BroadcastOptions {
  /**
   * default false
   */
  includeSelfFromWorker?: boolean;
  /**
   * default false
   */
  includeMainFromWorker?: boolean;
  relatedMessageId?: string;
  relatedWorkerId?: string;
  topic?: string;
}

export interface SubscribeOptions {
  topic?: string;
  subscribeOnce?: boolean;
}

export type SubscribeTopicListener = (
  message: Message,
  callback?: (data: any) => void
) => void;

export interface IEventBus<T> {
  addWorker(worker: T);
  start(): Promise<void>;
  subscribe(callback: (message: Message) => void, options?: SubscribeOptions);
  subscribeOnce(
    callback: (message: Message) => void,
    options?: SubscribeOptions
  );
  publishAsync(data: unknown, publishOptions?: PublishOptions): Promise<any>;
  publish(data: unknown, publishOptions?: PublishOptions);
  broadcast(data: unknown, options?: BroadcastOptions);
  isMain(): boolean;
  isWorker(): boolean;
  getWorkerId(worker: T): string;
  stop(): Promise<void>;
  onInited(listener: (message: Message) => void);
  onPublish(listener: (message: Message) => void);
  onSubscribe(listener: (message: Message) => void);
  onError(listener: (err: Error) => void);
}
