# Parent Worker Bridge
A bridge for running functions between a parent and a worker thread using promises.

## Installation

### Node

```bash
npm install parent-worker-bridge
```

or

```bash
yarn add parent-worker-bridge
```

## Usage Example

### Worker

```javascript
const { ParentWorkerBridge } = require('parent-worker-bridge');
const { parentPort } = require('worker_threads');
const parentBridge = new ParentWorkerBridge(parentPort);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

parentBridge.registerFunction('testing', async (n) => {
    await delay(1000);
    if (n === 4) throw new Error('my message');
    return n;
});

parentBridge.say("Hello from worker!");
```

### Parent (Main Thread)

```javascript
const { ParentWorkerBridge } = require('parent-worker-bridge');
const { Worker } = require('worker_threads');
const path = require('path');

const workerBridge = new ParentWorkerBridge(new Worker(path.join(__dirname, 'worker.js')));

workerBridge.registerFunction('say', async (msg) => {
    console.log('Worker says:', msg); // Worker says: Hello from worker!
});

workerBridge.testing(1).then((result) => {
    console.log('1 Result:', result); // 1 Result: 1
});

workerBridge.testing(2).then((result) => {
    console.log('2 Result:', result); // 2 Result: 2
});

workerBridge.testing(4).catch((e) => {
    console.log('Error:', e.message); // Error: my message
});

workerBridge.testing(3).then((result) => {
    console.log('3 Result:', result); // 3 Result: 3
});
```