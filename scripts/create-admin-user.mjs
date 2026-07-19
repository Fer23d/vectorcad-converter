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

async function syncPublicRole(userId, email) {
  const now = new Date().toISOString();
  await supabase.from("profiles").upsert({
    user_id: userId,
    name: "Admin",
    surname: "vetorcad",
    admin_role: "SUPER_ADMIN",
    updated_at: now,
  }, { onConflict: "user_id" }).then(({ error }) => {
    if (error && error.code !== "42P01" && error.code !== "42703" && error.code !== "PGRST205") {
      console.warn(`Aviso ao sincronizar profiles: ${error.message}`);
    }
  });

  await supabase.from("users").upsert({
    id: userId,
    email,
    admin_role: "SUPER_ADMIN",
    updated_at: now,
  }, { onConflict: "id" }).then(({ error }) => {
    if (error && error.code !== "42P01" && error.code !== "42703" && error.code !== "PGRST205") {
      console.warn(`Aviso ao sincronizar users: ${error.message}`);
    }
  });
}

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

  await syncPublicRole(existing.id, adminEmail);
  console.log(`Admin atualizado: ${adminEmail} (${existing.id})`);
  process.exit(0);
}

const { data, error } = await supabase.auth.admin.createUser({
  email: adminEmail,
  password: adminPassword,
  email_confirm: true,
  app_metadata: { role: "SUPER_ADMIN" },
  user_metadata: { role: "SUPER_ADMIN", first_name: "Admin", last_name: "vetorcad" },
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

await syncPublicRole(data.user.id, adminEmail);
console.log(`Admin criado: ${adminEmail} (${data.user.id})`);
