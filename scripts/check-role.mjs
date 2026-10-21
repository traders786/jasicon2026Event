import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.$queryRawUnsafe(`
    SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls
    FROM pg_roles
    WHERE rolname = 'eventcheck_app'
  `);
  console.log(JSON.stringify(roles, null, 2));
}

main().finally(() => prisma.$disconnect());
