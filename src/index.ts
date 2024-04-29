import { randomId } from "./helpers";

interface MessageController {
    on(event: string, callback: (message: any) => void): void;
    postMessage(message: any): void;
}

enum MessageTypes {
    RUN_FUNCTION = 'RUN_FUNCTION',
    FUNCTION_RESPONSE = 'FUNCTION_RESPONSE',
}

type GenericFunction = (...args: any[]) => Promise<any>;

class ParentWorkerBridge {
    private _messageController: MessageController;
    private pendingFunctions: { [id: string]: { resolve: Function; reject: Function } };
    private functions: { [name: string]: Function };

    [functionName: string]: GenericFunction | any;  // Index signature for dynamic method names

    constructor(messageController: MessageController) {
        this._messageController = messageController;
        this.pendingFunctions = {};
        this.functions = {};

        this._messageController.on('message', (message) => {
            this._messageHandler(message);
        });

        new Proxy(this, {
            get: (target: any, functionName: string | symbol, receiver: any) => {
                if (typeof target[functionName] === 'undefined') {
                    return (...args: any[]) => this._sendRunFunction({ functionName, args });
                }
                return Reflect.get(target, functionName, receiver);
            }
        });
    }

    private _sendRunFunction({ functionName, args }: { functionName: string | symbol, args: any[] }): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = randomId();
            this.pendingFunctions[id] = { resolve, reject };
            this._messageController.postMessage({
                type: MessageTypes.RUN_FUNCTION,
                id,
                functionName,
                args
            });
        });
    }

    private _sendFunctionResponse({ id, data, error }: { id: string, data?: any, error?: string }): void {
        this._messageController.postMessage({
            type: MessageTypes.FUNCTION_RESPONSE,
            id,
            data,
            error
        });
    }

    private _messageHandler(message: any): void {
        if (typeof message !== 'object' || !message.type) return;

        if (message.type === MessageTypes.FUNCTION_RESPONSE) {
            this._handleExternalFunctionResponse(message);
        }

        if (message.type === MessageTypes.RUN_FUNCTION) {
            this._handleRunExternalFunction(message);
        }
    }

    private _handleExternalFunctionResponse(message: any): void {
        if (!message.id || !this.pendingFunctions[message.id]) return;
        const { resolve, reject } = this.pendingFunctions[message.id];
        delete this.pendingFunctions[message.id];
        if (message.error) {
            reject(new Error(message.error));
        } else {
            resolve(message.data);
        }
    }

    private async _handleRunExternalFunction(message: any): Promise<void> {
        if (!message.id || !message.functionName || !this.functions[message.functionName]) {
            this._sendFunctionResponse({
                id: message.id,
                error: `Function ${String(message.functionName)} not found`
            });
            return;
        }

        try {
            const result = await this.functions[String(message.functionName)](...message.args);
            this._sendFunctionResponse({
                id: message.id,
                data: result
            });
        } catch (e) {
            this._sendFunctionResponse({
                id: message.id,
                error: e instanceof Error ? e.message : 'Unknown error'
            });
        }
    }

    public registerFunction(name: string, fn: Function): void {
        this.functions[name] = fn;
    }

    public deleteFunction(name: string): void {
        delete this.functions[name];
    }
}

export { ParentWorkerBridge };
