# Event-Bus

Event Bus 用来完成父子进程之间的消息传递，包括同步的调用，异步的发送，以及广播的能力，支持进程和线程两种模式。

## Usage

基础使用，在不同的进程间引入。

```ts
/**
 * in main
 */
import { ThreadEventBus } from '@midwayjs/event-bus';

// 创建一个 bus
const bus = new ThreadEventBus();

// 添加一个 worker
const worker = new Worker();
bus.addWorker(worker);

// 等待连接和启动
await bus.start();

// 发布消息
bus.publish('hello world');


/**
 * in worker
 */

import { ThreadEventBus } from '@midwayjs/event-bus';
const bus = new ThreadEventBus();

await bus.start();

bus.subscribe(message => {
  console.log(message.body);
  // => 'hello world'
});

```


## API

**publish**

```ts
bus.publish({
  data: 'abc'
});
```

**subscribe**

```ts
bus.subscribe(message => {
  // ...
});
```

**publishAsync**

```ts
await bus.publishAsync(message, {
  timeout: 3000,
});
```

**broadcast**

```ts
bus.broadcast({
  data: 'abc'
});
```
