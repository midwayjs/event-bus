import { format } from 'util';

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
  constructor(message, err) {
    super(
      format('Mainthread post message [%j] error => %s.', message, err.stack)
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

export class EventBusPublishSpecifyWorkerError extends Error {
  constructor(workerId) {
    super(
      format(
        'Worker(%s) not find in ready map, maybe it is a wrong pid.',
        workerId
      )
    );
    this.name = 'EventBusPublishSpecifyWorkerError';
  }
}
