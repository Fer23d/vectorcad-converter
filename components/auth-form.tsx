"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

function authMessage(mode: AuthMode, message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalid login credentials")) {
    return "Email ou senha incorretos. Se ainda nao criou conta, clique em Criar conta.";
  }

  if (mode === "signup" && lowerMessage.includes("already")) {
    return "Esse email ja existe. Tente fazer login.";
  }

  if (lowerMessage.includes("email not confirmed")) {
    return "A confirmacao de email ainda esta ativa no Supabase. Desative em Auth > Sign In / Providers para liberar login imediato.";
  }

  return message;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [message, setMessage] = useState(isSupabaseConfigured ? mode === "login" ? "Faca login para acessar seus projetos." : "Crie sua conta para iniciar o VectorCAD." : "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    client.auth.getSession().then(({ data }) => {
      setLoading(false);
      if (data.session) router.replace("/dashboard");
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/dashboard");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client) return;
    setLoading(true);

    const { data, error } = mode === "login"
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password });

    setLoading(false);
    if (error) {
      setMessage(authMessage(mode, error.message));
      return;
    }

    if (data.session) {
      setMessage(mode === "signup" ? "Conta criada. Abrindo dashboard..." : "Login realizado.");
      router.replace("/dashboard");
      return;
    }

    setMessage("Conta criada, mas o Supabase ainda exige confirmacao de email. Desative essa opcao no painel para login imediato.");
  };

  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] p-5">
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-[#33413a] bg-[#101613] p-6 text-[#e8efeb] shadow-2xl">
      <div className="mb-6 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#b7f34a] text-[#09120d]"><Box size={20} /></div><div><div className="text-sm font-black tracking-[.16em]">VECTORCAD</div><div className="text-[10px] text-[#84938b]">{mode === "login" ? "Login SaaS" : "Criar conta"}</div></div></div>
      <label className="mb-3 block text-xs text-[#aab8b1]">Email<input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full" type="email" required /></label>
      <label className="mb-4 block text-xs text-[#aab8b1]">Senha<input value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full" type="password" required minLength={6} /></label>
      <button disabled={loading || !isSupabaseConfigured} className="w-full rounded-lg bg-[#b7f34a] py-3 text-xs font-black text-[#09120d] disabled:opacity-60">{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
      <p className="mt-4 text-center text-[11px] text-[#8c9a93]">{message}</p>
      <div className="mt-5 text-center text-xs text-[#aab8b1]">
        {mode === "login" ? <>Nao tem conta? <Link className="font-bold text-[#b7f34a]" href="/signup">Criar conta</Link></> : <>Ja tem conta? <Link className="font-bold text-[#b7f34a]" href="/login">Entrar</Link></>}
      </div>
    </form>
  </main>;
}
