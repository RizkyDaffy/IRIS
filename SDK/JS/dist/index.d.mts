export { I as Iris, a as IrisConfig, P as PublishPayload, b as PublishResult, R as RouteSchema } from './client-BOI-oIzp.mjs';
import 'events';

declare class IrisConfigError extends Error {
    constructor(message: string);
}
declare class IrisApiError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string);
}

export { IrisApiError, IrisConfigError };
