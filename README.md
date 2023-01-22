# Event-Bus

Event Bus 用来完成父子进程之间的消息传递，包括同步的调用，异步的发送，以及广播的能力，支持进程、线程、同一进程内调用三种模式。

## Usage

基础使用，在不同的进程间引入。

如下，创建 Thread 模式的 EventBus。

```ts
/**
 * in main
 */
import { ThreadEventBus } from '@midwayjs/event-bus';

// 创建一个 bus
const bus = new ThreadEventBus({
  isWorker: false,
});

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
// 创建 bus 客户端
const bus = new ThreadEventBus({
  isWorker: true,
});

// 启动客户端，自动向 master 发送消息
await bus.start();

// 订阅消息
bus.subscribe(message => {
  console.log(message.body);
  // => 'hello world'
});

```

可以创建 Cluster 模式的 EventBus，接口相同。

```ts
import { ChildProcessEventBus } from '@midwayjs/event-bus';

// in main
const bus = new ChildProcessEventBus({
  isWorker: false,
});
await bus.start();

// in worker
const bus = new ChildProcessEventBus({
  isWorker: true,
});

// 启动客户端，自动向 master 发送消息
await bus.start();
```

为了方便同进程研发，也提供了相同接口的 LocalEventBus。

```ts
import { LocalEventBus } from '@midwayjs/event-bus';

// in main
const bus = new LocalEventBus({
  isWorker: false,
});
await bus.start();

// in worker
const bus = new LocalEventBus({
  isWorker: true,
});

await bus.start();
```

注意，本地模式下，需要在不同文件中，且 worker 只能有一个。


## API

**start**

bus 启动后，需要调用此方法，才能正常使用。

main 调用后会等待 worker 启动，worker 调用后会向 main 发送消息。

```ts
// in main & worker
await bus.start();
```

如果 worker 启动错误，可以传递异常给 main。

```ts
// worker
await bus.start(new Error('worker error'));

// main
bus.onError(error => {
  console.log(error.message);
  // => 'worker error'
});
```


**Publish & Subscribe**

异步的发送和监听消息，支持 main 和 worker 双向发送， API 一致。

```ts
bus.subscribe(message => {
  // message.body === {data: 'abc'}
});

bus.publish({
  data: 'abc'
});

```

指定某个 topic 发送消息。

```ts
bus.subscribe(message => {
  // message.body === {data: 'abc'}
}, {
  topic: 'test'
});

bus.publish({
  data: 'abc'
}, {
  topic: 'test'
});

```

publish 错误。

```ts
const err = new Error('test');
bus.publish(err);
```


**publishAsync**

同步的发送消息，会等待订阅方返回，包含超时参数，默认 5s。

此 API 仅限于 main 向 worker 发送消息。

```ts

// subscribe
bus.subscribe((message, responder) => {
  // message.body === {data: 'abc'}

  responder && responder.send({
    data: 'hello world',
  });

  // send error
  responder.error(new Error('test'));
});

// invoke
const result = await bus.publishAsync({
  data: 'abc'
}, {
  timeout: 5000,
});

// result => {data: 'hello world'}

```

**publishChunk**

发送消息，会等待订阅方返回多次，包含超时参数，默认 5s。

此 API 仅限于 main 向 worker 发送消息。

```ts

// subscribe
bus.subscribe((message, responder) => {
  responder.send('hello');
  responder.send(' world');
  responder.end();
});

// invoke
const dataCollector = bus.publishChunk({
  data: 'abc'
}, {
  timeout: 5000,
});

let result = '';
dataCollector.onData(data => {
  result += data;
});

dataCollector.onEnd(() => {
  // result => 'hello world'
});

```

**broadcast**

广播消息（一对多）。

```ts
// worker
bus.subscribe(message => {
  // message.body === {data: 'abc'}
});

// main
bus.broadcast({
  data: 'abc'
});
```

也支持 worker 向其他 main 或者 worker 广播。

```ts
// worker
bus.broadcast('hello world');
```

默认情况下，worker 广播之后，**main** 和 **当前 worker** 都不会收到这条消息

可以通过设置属性，让当前 Worker 也同时接收这条消息。

```ts
// worker
bus.broadcast('hello world', {
  includeSelfFromWorker: true,
});
```

可以通过设置属性，让 main 也同时接收这条消息。

```ts
// worker
bus.broadcast('hello world', {
  includeMainFromWorker: true,
});
```



## Message 类型

包含以下属性

- `messageId` 用来确定消息的唯一 id
- `workerId`  消息发送的 worker id
- `type` 消息发送的类型，包括 inited(初始化)，request（main 向 worker 发送），response（worker 向 main 发送），invoke（同步的 main 向 worker 发送），broadcast（广播）几种类型
- `error` 意外的报错信息
- `messageOptions` 在发送消息时额外的参数，比如超时时间等，具体看类型定义


## 调试

使用环境变量 `NODE_DEBUG=midway:event-bus*` 开启调试输出。


## 注意

所有的消息必须可序列化，不能传递复杂对象，类，方法等。

## License

MIT
