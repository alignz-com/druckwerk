import "dotenv/config";
import { defineConfig } from "prisma/config";

const FALLBACK_URL = "postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL || FALLBACK_URL,
  },
});
