export const EVENT_MSG_INITED = 'message_inited';
export const EVENT_MSG_REQUEST = 'message_request';
export const EVENT_MSG_RESPONSE = 'message_response';
export const EVENT_MSG_INVOKE = 'message_invoke';
export const EVENT_MSG_BROADCAST = 'message_broadcast';

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
  workerId: number;
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
  isWorker?: boolean;
}

export interface PublishOptions {
  timeout?: number;
  relatedMessageId?: string;
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
  relatedWorkerId?: number;
}

export interface IEventBus<T> {
  addWorker(worker: T);
  start(): Promise<void>;
  subscribe(callback: (message: Message) => void);
  publishAsync(data: Message, publishOptions?: PublishOptions): Promise<any>;
  publish(data: Message, publishOptions?: PublishOptions);
  broadcast(data: Message, options?: BroadcastOptions);
  isMain(): boolean;
  isWorker(): boolean;
  getWorkerId(worker: T): string;
  stop(): Promise<void>;
  onInited(listener: (message: Message) => void);
  onPublish(listener: (message: Message) => void);
  onSubscribe(listener: (message: Message) => void);
  onError(listener: (err: Error) => void);
}
