import { PrismaClient } from '@prisma/client';

// @rizkydaffy: singleton — one connection pool for the whole process
export const db = new PrismaClient({
  log: [{ level: 'error', emit: 'event' }],
});
