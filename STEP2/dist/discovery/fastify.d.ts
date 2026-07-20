import { FastifyInstance } from 'fastify';
import { I as Iris } from '../client-BOI-oIzp.js';
import 'events';

declare function registerFastifyApp(iris: Iris, app: FastifyInstance): Promise<void>;

export { registerFastifyApp };
