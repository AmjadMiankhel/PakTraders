/**
 * Removes every demo tender (isDemo = true) and its dependants.
 * Reference data (categories, departments, provinces, plans) is preserved.
 */
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { PrismaClient } from "@prisma/client";

loadDotenv({ path: resolve(__dirname, "../../.env") });
loadDotenv();

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.tender.deleteMany({ where: { isDemo: true } });
  console.log(`Deleted ${result.count} demo tender(s) and cascaded documents/updates.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
