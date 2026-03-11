import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "pascal@alignz.com";
  const password = "Admin1234!";
  const name = "Pascal Rossi";

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { hashedPassword: hashed, role: "ADMIN", name },
    create: { email, name, hashedPassword: hashed, role: "ADMIN" },
  });

  console.log(`✅ Admin user ready: ${user.email} (role: ${user.role})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
