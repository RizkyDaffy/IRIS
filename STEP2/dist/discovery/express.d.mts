import { Express } from 'express';
import { I as Iris } from '../client-BOI-oIzp.mjs';
import 'events';

declare function registerExpressApp(iris: Iris, app: Express): Promise<void>;

export { registerExpressApp };
