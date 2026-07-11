import { createClient } from "@supabase/supabase-js";

function cleanEnv(value) {
  return value?.trim().replace(/^["']|["']$/g, "") || "";
}

const supabaseUrl = cleanEnv(process.env.SUPABASE_URL) || cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
const adminEmail = cleanEnv(process.env.ADMIN_EMAIL) || "admin@vetorcad.com.br";
const adminPassword = cleanEnv(process.env.ADMIN_PASSWORD);

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  process.exit(1);
}

if (!adminPassword || adminPassword.length < 12) {
  console.error("ADMIN_PASSWORD é obrigatório e deve ter pelo menos 12 caracteres.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) {
  console.error(listError.message);
  process.exit(1);
}

const existing = existingUsers.users.find((user) => user.email?.toLowerCase() === adminEmail.toLowerCase());

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    password: adminPassword,
    email_confirm: true,
    app_metadata: { ...(existing.app_metadata || {}), role: "SUPER_ADMIN" },
    user_metadata: { ...(existing.user_metadata || {}), role: "SUPER_ADMIN" },
  });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`Admin atualizado: ${adminEmail} (${existing.id})`);
  process.exit(0);
}

const { data, error } = await supabase.auth.admin.createUser({
  email: adminEmail,
  password: adminPassword,
  email_confirm: true,
  app_metadata: { role: "SUPER_ADMIN" },
  user_metadata: { role: "SUPER_ADMIN", first_name: "Admin", last_name: "VectorCAD" },
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`Admin criado: ${adminEmail} (${data.user.id})`);
