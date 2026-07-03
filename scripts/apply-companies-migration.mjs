import fs from "node:fs";
import pg from "pg";

const { Client } = pg;
const password = process.env.SUPABASE_DB_PASSWORD;

if (!password) {
  console.error("SUPABASE_DB_PASSWORD is required.");
  process.exit(1);
}

const sqlPath = process.argv[2] || "supabase/migrations/20260703203000_create_companies.sql";
const sql = fs.readFileSync(sqlPath, "utf8");

const configs = [
  {
    name: "transaction pooler sa-east-1",
    host: "aws-0-sa-east-1.pooler.supabase.com",
    port: 6543,
    user: "postgres.hlsoigzqyzaxjiokvdja",
  },
  {
    name: "session pooler sa-east-1",
    host: "aws-0-sa-east-1.pooler.supabase.com",
    port: 5432,
    user: "postgres.hlsoigzqyzaxjiokvdja",
  },
  {
    name: "direct database",
    host: "db.hlsoigzqyzaxjiokvdja.supabase.co",
    port: 5432,
    user: "postgres",
  },
];

async function applyMigration(config) {
  const client = new Client({
    ...config,
    database: "postgres",
    password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end().catch(() => {});
  }
}

const errors = [];

for (const config of configs) {
  try {
    console.log(`Trying ${config.name}...`);
    await applyMigration(config);
      console.log(`migration applied: ${sqlPath}`);
    process.exit(0);
  } catch (error) {
    errors.push(`${config.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.error(`Could not apply migration: ${sqlPath}`);
for (const error of errors) console.error(`- ${error}`);
process.exit(1);
