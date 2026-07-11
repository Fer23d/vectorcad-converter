"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, Eye, EyeOff, X } from "lucide-react";
import { normalizeCompany } from "@/lib/access-control";
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
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
      : await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            company: normalizeCompany(company),
          },
        },
      });

    setLoading(false);
    if (error) {
      setMessage(authMessage(mode, error.message));
      return;
    }

    if (mode === "signup" && data.session?.access_token) {
      if (data.user) {
        await client.from("profiles").upsert({
          user_id: data.user.id,
          name: firstName.trim() || null,
          surname: lastName.trim() || null,
          company: normalizeCompany(company),
        }, { onConflict: "user_id" });
      }

      fetch("/api/email/welcome", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      }).catch(() => null);
    }

    if (data.session) {
      setMessage(mode === "signup" ? "Conta criada. Abrindo dashboard..." : "Login realizado.");
      router.replace("/dashboard");
      return;
    }

    setMessage("Conta criada, mas o Supabase ainda exige confirmacao de email. Desative essa opcao no painel para login imediato.");
  };

  const openPasswordReset = () => {
    setResetEmail(email.trim().toLowerCase());
    setShowResetModal(true);
    setMessage("Informe seu email para receber um link seguro de redefinicao.");
  };

  const requestPasswordReset = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const normalizedEmail = resetEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage("Digite seu email no modal para receber o link de redefinicao.");
      return;
    }

    setResetLoading(true);
    const response = await fetch("/api/email/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const payload = await response.json().catch(() => ({}));
    setResetLoading(false);

    if (!response.ok) {
      setMessage(payload.error || "Nao foi possivel enviar o email de redefinicao.");
      return;
    }

    setShowResetModal(false);
    setMessage("Enviamos um link seguro de redefinicao para seu email.");
  };

  const inputClass = "mt-2 w-full rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 text-sm text-[#eef5f1] outline-none transition placeholder:text-[#56645d] focus:border-[#b7f34a] focus:ring-2 focus:ring-[#b7f34a]/20";
  const passwordInputClass = "w-full rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 pr-12 text-sm text-[#eef5f1] outline-none transition placeholder:text-[#56645d] focus:border-[#b7f34a] focus:ring-2 focus:ring-[#b7f34a]/20";

  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] px-5 py-10">
    <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-[#33413a] bg-[#101613]/95 p-8 text-[#e8efeb] shadow-2xl shadow-black/40 backdrop-blur">
      <div className="mb-7 flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d] shadow-lg shadow-[#b7f34a]/20"><Box size={22} /></div><div><div className="text-base font-black tracking-[.18em]">VECTORCAD</div><div className="mt-1 text-[11px] text-[#84938b]">{mode === "login" ? "Acesse seu workspace SaaS" : "Crie sua conta profissional"}</div></div></div>
      {mode === "signup" && <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-bold text-[#aab8b1]">Nome<input value={firstName} onChange={(event) => setFirstName(event.target.value)} className={inputClass} type="text" placeholder="Fernando" required /></label>
        <label className="block text-xs font-bold text-[#aab8b1]">Sobrenome<input value={lastName} onChange={(event) => setLastName(event.target.value)} className={inputClass} type="text" placeholder="Fernandes" required /></label>
      </div>}
      {mode === "signup" && <label className="mb-4 block text-xs font-bold text-[#aab8b1]">Empresa <span className="text-[#66756d]">(opcional)</span><input value={company} onChange={(event) => setCompany(event.target.value)} className={inputClass} type="text" placeholder="SM&A" /></label>}
      <label className="mb-4 block text-xs font-bold text-[#aab8b1]">Email<input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} type="email" placeholder="voce@email.com" required /></label>
      <label className="mb-3 block text-xs font-bold text-[#aab8b1]">Senha
        <div className="relative mt-2 w-full">
          <input value={password} onChange={(event) => setPassword(event.target.value)} className={passwordInputClass} type={showPassword ? "text" : "password"} placeholder="Sua senha" required minLength={6} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#8d9a93] transition hover:bg-[#17221c] hover:text-[#b7f34a]">
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
      {mode === "login" && <div className="mb-5 flex w-full justify-end">
        <button type="button" onClick={openPasswordReset} className="text-right text-sm font-black text-[#b7f34a] underline-offset-4 transition duration-200 hover:-translate-y-0.5 hover:text-white hover:underline focus:outline-none focus:ring-2 focus:ring-[#b7f34a]/40">
          Esqueci minha senha
        </button>
      </div>}
      <button disabled={loading || !isSupabaseConfigured} className="w-full rounded-xl bg-[#b7f34a] py-3.5 text-sm font-black text-[#09120d] shadow-lg shadow-[#b7f34a]/10 transition hover:brightness-105 disabled:opacity-60">{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>
      <p className="mt-5 rounded-2xl border border-[#26312c] bg-[#0b100e] px-4 py-3 text-center text-xs leading-5 text-[#8c9a93]">{message}</p>
      <div className="mt-6 text-center text-sm text-[#aab8b1]">
        {mode === "login" ? <>Nao tem conta? <Link className="font-bold text-[#b7f34a]" href="/signup">Criar conta</Link></> : <>Ja tem conta? <Link className="font-bold text-[#b7f34a]" href="/login">Entrar</Link></>}
      </div>
    </form>
    {showResetModal && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <form onSubmit={requestPasswordReset} className="w-full max-w-md rounded-3xl border border-[#33413a] bg-[#101613] p-7 text-[#e8efeb] shadow-2xl shadow-black/50">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]">Recuperar acesso</div>
            <h2 className="mt-2 text-2xl font-black tracking-[-.03em]">Esqueci minha senha</h2>
            <p className="mt-2 text-sm leading-6 text-[#8c9a93]">Digite seu email e enviaremos um link seguro para criar uma nova senha.</p>
          </div>
          <button type="button" onClick={() => setShowResetModal(false)} aria-label="Fechar recuperacao de senha" className="rounded-xl border border-[#34423c] p-2 text-[#8d9a93] transition hover:bg-[#17221c] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <label className="mb-5 block text-xs font-bold text-[#aab8b1]">Email
          <input value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} className={inputClass} type="email" placeholder="voce@email.com" required />
        </label>
        <button disabled={resetLoading} className="w-full rounded-xl bg-[#b7f34a] py-3.5 text-sm font-black text-[#09120d] transition hover:brightness-105 disabled:opacity-60">
          {resetLoading ? "Enviando..." : "Enviar link de redefinicao"}
        </button>
      </form>
    </div>}
  </main>;
}
