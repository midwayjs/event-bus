import { format } from 'util';

export class EventBusPublishTimeoutError extends Error {
  constructor(messageId: string) {
    super(`Message(${messageId}) publish timeout.`);
    this.name = 'EventBusPublishTimeoutError';
  }
}

export class EventBusWaitWorkerInitedTimeoutError extends Error {
  constructor() {
    super('Some worker inited timeout and throw this error.');
    this.name = 'EventBusWaitWorkerInitedTimeoutError';
  }
}

export class EventBusMainPostError extends Error {
  constructor(message, err) {
    super(
      format('Mainthread post message [%j] error => %j.', message, err.stack)
    );
    this.name = 'EventBusMainPostError';
  }
}

export class EventBusWorkerPostError extends Error {
  constructor(message, err) {
    super(format('Worker post message [%j] error => %j.', message, err.stack));
    this.name = 'EventBusWorkerPostError';
  }
}
