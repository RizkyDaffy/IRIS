import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import crypto from 'crypto';

const db = new PrismaClient();

async function main() {
  const name = "Henkaten App";
  const targetUrl = "http://localhost:8000";
  
  let app = await db.application.findUnique({ where: { name } });
  
  if (app) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(token, { type: argon2.argon2id });
    const tokenPrefix = token.slice(0, 8);
    
    app = await db.application.update({
      where: { name },
      data: { tokenHash, tokenPrefix, targetUrl }
    });
    console.log(`Updated existing app. Token: ${token}`);
  } else {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(token, { type: argon2.argon2id });
    const tokenPrefix = token.slice(0, 8);
    
    app = await db.application.create({
      data: { name, targetUrl, tokenHash, tokenPrefix }
    });
    console.log(`Created new app. Token: ${token}`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
