import type { Worker } from 'worker_threads';
import type { ChildProcess } from 'child_process';

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
  /**
   * publish async: main => worker
   */
  Invoke = 'invoke',
  /**
   * broadcast to all workers, or except the specified worker
   */
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
  error?: {
    name: string;
    message: string;
    stack: string;
  };
  body: BODY;
  messageOptions?: PublishOptions | BroadcastOptions;
};

export type EventCenterMessage = {
  messageCategory: MessageCategory;
  message: Message;
};

export interface EventBusOptions<Worker> {
  initTimeout?: number;
  initTimeoutCheckInterval?: number;
  isWorker?: boolean;
  /**
   * custom worker dispatcher
   */
  dispatchStrategy?: (
    workers: Worker[],
    dispatchToken: any
  ) => Worker | undefined;
}

export interface LocalEventBusOptions extends EventBusOptions<any> {
  waitWorkerTimeout?: number;
  waitWorkerCheckInterval?: number;
}

export interface ThreadEventBusOptions extends EventBusOptions<Worker> {
  encoder?: (message: Message) => any;
  decoder?: (serializedData: any) => Message;
}

export type ChildProcessEventBusOptions = EventBusOptions<ChildProcess>;

export interface WaitCheckOptions {
  timeout?: number;
  timeoutCheckInterval?: number;
  ErrorClz?: new (...args) => Error;
}

export interface PublishOptions {
  relatedMessageId?: string;
  targetWorkerId?: string;
  topic?: string;
  timeout?: number;
  isChunk?: boolean;
  /**
   * dispatch strategy will be selected according to this token
   */
  dispatchToken?: any;
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
  responder?: IResponder
) => void | Promise<void>;

export type SubscribeAbortController = {
  abort: () => void;
};

export interface IEventBus<T> {
  addWorker(worker: T);
  start(err?: Error): Promise<void>;
  subscribe(
    callback: SubscribeTopicListener,
    options?: SubscribeOptions
  ): SubscribeAbortController;
  subscribeOnce(
    callback: SubscribeTopicListener,
    options?: SubscribeOptions
  ): SubscribeAbortController;
  publishAsync<ResData>(
    data: unknown,
    publishOptions?: PublishOptions
  ): Promise<ResData>;
  publishChunk<ResData = unknown>(
    data: unknown,
    publishOptions?: PublishOptions
  ): AsyncIterable<ResData>;
  publish(data: unknown, publishOptions?: PublishOptions): void;
  broadcast(data: unknown, options?: BroadcastOptions): void;
  isMain(): boolean;
  isWorker(): boolean;
  getWorkerId(worker: T): string;
  stop(): Promise<void>;
  onInited(listener: (message: Message) => void);
  onPublish(listener: (message: Message) => void);
  onSubscribe(listener: (message: Message) => void);
  onError(listener: (err: Error) => void);
}

export interface IResponder {
  end(data?: unknown): void;
  send(data: unknown): void;
  error(err: Error): void;
  isEnd(): boolean;
}
