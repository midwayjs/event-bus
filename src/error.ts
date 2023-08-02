import { format } from 'util';
import { Message } from './interface';

export class EventBusPublishTimeoutError extends Error {
  constructor(messageId: string) {
    super(`Message(${messageId}) publish timeout.`);
    this.name = 'EventBusPublishTimeoutError';
  }
}

export class EventBusTimeoutError extends Error {
  constructor() {
    super('Waiting for ready timeout throws this error.');
    this.name = 'EventBusTimeoutError';
  }
}

export class EventBusMainPostError extends Error {
  constructor(message: Message, err: Error) {
    super(
      format('Main thread post message [%j] error => %s.', message, err.stack)
    );
    this.name = 'EventBusMainPostError';
  }
}

export class EventBusWorkerPostError extends Error {
  constructor(message: Message, err: Error) {
    super(format('Worker post message [%j] error => %j.', message, err.stack));
    this.name = 'EventBusWorkerPostError';
  }
}

export class EventBusPublishSpecifyWorkerError extends Error {
  constructor(workerId: string) {
    super(
      format(
        'Worker(%s) not find in ready map, maybe it is a wrong pid.',
        workerId
      )
    );
    this.name = 'EventBusPublishSpecifyWorkerError';
  }
}

export class EventBusDispatchStrategyError extends Error {
  constructor() {
    super('Dispatch strategy not found a worker and stop post.');
    this.name = 'EventBusDispatchStrategyError';
  }
}
