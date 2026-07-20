import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const routes = await db.route.findMany({
    where: { application: { name: 'Henkaten App' } },
    select: { path: true, method: true }
  });
  
  console.log(`Routes count: ${routes.length}`);
  if (routes.length > 0) {
    console.log(routes.slice(0, 5));
  }
}

main().catch(console.error).finally(() => db.$disconnect());
