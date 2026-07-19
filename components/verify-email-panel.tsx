"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import { normalizeEmail } from "@/lib/auth/email-domain";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

function storedEmail() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("vectorcad_pending_verification_email") || "";
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(() => normalizeEmail(queryEmail || storedEmail()));
  const [message, setMessage] = useState(isSupabaseConfigured ? "Verificando o status da sua conta..." : "Supabase não configurado.");
  const [status, setStatus] = useState<"idle" | "success" | "error">(isSupabaseConfigured ? "idle" : "error");
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => normalizeEmail(email || queryEmail), [email, queryEmail]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const authClient = client;

    let cancelled = false;
    async function verifySession() {
      const code = searchParams.get("code");
      if (code) {
        const { error } = await authClient.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          setStatus("error");
          setMessage("Link de confirmação inválido ou expirado. Solicite um novo e-mail.");
          return;
        }
      }

      const { data } = await authClient.auth.getUser();
      if (cancelled) return;

      if (data.user?.email_confirmed_at) {
        setStatus("success");
        setMessage("E-mail confirmado com sucesso. Redirecionando para o dashboard...");
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("vectorcad_pending_verification_email");
          const sentWelcomeKey = `vectorcad_welcome_sent_${data.user.id}`;
          if (!window.localStorage.getItem(sentWelcomeKey)) {
            const { data: sessionData } = await authClient.auth.getSession();
            if (sessionData.session?.access_token) {
              fetch("/api/email/welcome", {
                method: "POST",
                headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
              }).catch(() => null);
              window.localStorage.setItem(sentWelcomeKey, "1");
            }
          }
        }
        window.setTimeout(() => router.replace("/dashboard"), 1200);
        return;
      }

      setStatus("idle");
      setMessage("Enviamos um link de confirmação para o seu endereço de e-mail. Verifique sua caixa de entrada para ativar sua conta vetorcad.");
    }

    verifySession();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  const resendConfirmation = async () => {
    if (!normalizedEmail) {
      setStatus("error");
      setMessage("Informe o e-mail usado no cadastro para reenviar o link.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/auth/resend-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error || "Não foi possível reenviar o e-mail. O link pode ter expirado ou a conta já pode estar confirmada.");
      return;
    }

    if (typeof window !== "undefined") window.localStorage.setItem("vectorcad_pending_verification_email", normalizedEmail);
    setStatus("success");
    setMessage(payload.message || "Enviamos um novo link de confirmação para o seu e-mail.");
  };

  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] px-5 py-10 text-[#e8efeb]">
    <section className="w-full max-w-xl rounded-3xl border border-[#33413a] bg-[#101613]/95 p-8 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d] shadow-lg shadow-[#b7f34a]/20"><MailCheck size={23} /></div>
        <div>
          <div className="text-base font-black tracking-[.12em]">vetorcad</div>
          <div className="mt-1 text-[11px] text-[#84938b]">Ativação segura da conta</div>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-[#26312c] bg-[#0b100e] p-6">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#b7f34a]"><ShieldCheck size={15} /> Confirmação obrigatória</div>
        <h1 className="mt-4 text-3xl font-black tracking-[-.04em]">Confirme seu e-mail</h1>
        <p className="mt-4 text-sm leading-7 text-[#aebeb6]">
          Enviamos um link de confirmação para o seu endereço de e-mail. Verifique sua caixa de entrada para ativar sua conta vetorcad.
        </p>
        <p className={`mt-5 rounded-2xl border px-4 py-3 text-sm leading-6 ${status === "success" ? "border-[#b7f34a]/40 bg-[#172314] text-[#dfffc0]" : status === "error" ? "border-red-500/30 bg-red-950/20 text-red-100" : "border-[#2d3933] bg-[#101613] text-[#9caaa3]"}`}>{message}</p>
      </div>

      <label className="mt-6 block text-xs font-bold text-[#aab8b1]">E-mail
        <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 text-sm text-[#eef5f1] outline-none transition placeholder:text-[#56645d] focus:border-[#b7f34a] focus:ring-2 focus:ring-[#b7f34a]/20" type="email" placeholder="nome@email.com" />
      </label>

      <button type="button" onClick={resendConfirmation} disabled={loading || !isSupabaseConfigured} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b7f34a] py-3.5 text-sm font-black text-[#09120d] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        {loading ? "Reenviando..." : "Reenviar e-mail"}
      </button>

      <div className="mt-6 flex flex-col gap-3 text-center text-sm text-[#aab8b1] sm:flex-row sm:justify-center">
        <Link href="/login" className="font-bold text-[#b7f34a] underline-offset-4 hover:underline">Voltar ao login</Link>
        <span className="hidden text-[#425047] sm:inline">•</span>
        <Link href="/contato" className="font-bold text-[#b7f34a] underline-offset-4 hover:underline">Preciso de ajuda</Link>
      </div>
    </section>
  </main>;
}

export function VerifyEmailPanel() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#080c0b] text-[#e8efeb]"><div className="text-xs uppercase tracking-[.18em] text-[#b7f34a]">Carregando confirmação...</div></main>}>
    <VerifyEmailContent />
  </Suspense>;
}
