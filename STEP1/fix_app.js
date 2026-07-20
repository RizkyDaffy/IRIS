const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const crypto = require('crypto');

const db = new PrismaClient();

async function main() {
  const appId = "cmripn7jd00179ce4qgi4pt8c";
  const targetUrl = "http://localhost:8080";
  
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = await argon2.hash(token, { type: argon2.argon2id });
  const tokenPrefix = token.slice(0, 8);
  
  await db.application.update({
    where: { id: appId },
    data: { tokenHash, tokenPrefix, targetUrl }
  });
  console.log(`Updated app ${appId}. New Target URL: ${targetUrl}. New Token: ${token}`);
}

main().catch(console.error).finally(() => db.$disconnect());
