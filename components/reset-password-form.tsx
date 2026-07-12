"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Box, Eye, EyeOff, LockKeyhole } from "lucide-react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

const RECOVERY_TIMEOUT_MS = 9000;

function friendlyRecoveryError(value?: string | null) {
  const message = String(value || "").replace(/\+/g, " ");
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("expired") || lowerMessage.includes("expire")) {
    return "Este link de recuperação expirou. Solicite um novo e-mail em Esqueci minha senha.";
  }

  if (lowerMessage.includes("invalid") || lowerMessage.includes("malformed") || lowerMessage.includes("otp")) {
    return "Este link de recuperação expirou ou é inválido.";
  }

  if (message) return message;
  return "Não foi possível validar o link de recuperação.";
}

function friendlyUpdateError(value?: string | null) {
  const message = String(value || "");
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("session") || lowerMessage.includes("jwt")) {
    return "Sessão de recuperação inexistente ou expirada. Solicite um novo link.";
  }

  if (lowerMessage.includes("password") || lowerMessage.includes("weak")) {
    return "A senha não atende aos requisitos de segurança. Use pelo menos 6 caracteres e evite senhas muito simples.";
  }

  return message || "Não foi possível salvar a nova senha.";
}

function recoveryParams() {
  if (typeof window === "undefined") return new URLSearchParams();

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  hashParams.forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });

  return params;
}

function cleanRecoveryUrl() {
  if (typeof window !== "undefined") {
    window.history.replaceState({}, document.title, "/reset-password");
  }
}

function withTimeout<T>(promise: Promise<T>, fallbackMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(fallbackMessage)), RECOVERY_TIMEOUT_MS);

    promise
      .then((result) => resolve(result))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer));
  });
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [message, setMessage] = useState("Validando link de recuperação...");

  useEffect(() => {
    let cancelled = false;
    let authEventResolved = false;

    function finish(session: Session | null, successMessage = "Digite sua nova senha.") {
      if (cancelled) return;
      setHasRecoverySession(Boolean(session));
      setLoading(false);
      setMessage(session ? successMessage : "Este link de recuperação expirou ou é inválido.");
    }

    function fail(value?: string | null) {
      if (cancelled) return;
      setHasRecoverySession(false);
      setLoading(false);
      setMessage(friendlyRecoveryError(value));
    }

    async function confirmCurrentSession() {
      const client = supabase;
      if (!client) return null;
      const { data } = await withTimeout(
        client.auth.getSession(),
        "Tempo esgotado ao validar a sessão de recuperação.",
      );
      return data.session;
    }

    async function prepareRecovery() {
      const client = supabase;
      if (!client) {
        fail("Supabase não configurado.");
        return;
      }

      const subscription = client.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
        if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
          authEventResolved = true;
          cleanRecoveryUrl();
          finish(session, "Link validado. Digite sua nova senha.");
        }
      }).data.subscription;

      const params = recoveryParams();
      const errorDescription = params.get("error_description") || params.get("error");
      if (errorDescription) {
        subscription.unsubscribe();
        fail(errorDescription);
        return;
      }

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const linkType = params.get("type");

      if (linkType && linkType !== "recovery") {
        subscription.unsubscribe();
        fail("Link de recuperação inválido ou expirado.");
        return;
      }

      try {
        if (accessToken && refreshToken) {
          const { error } = await withTimeout(
            client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
            "Tempo esgotado ao validar o link de recuperação.",
          );
          if (error) throw error;
          cleanRecoveryUrl();
          finish(await confirmCurrentSession());
          subscription.unsubscribe();
          return;
        }

        if (code) {
          const { error } = await withTimeout(
            client.auth.exchangeCodeForSession(code),
            "Tempo esgotado ao trocar o código de recuperação.",
          );
          if (error) throw error;
          cleanRecoveryUrl();
          finish(await confirmCurrentSession());
          subscription.unsubscribe();
          return;
        }

        if (tokenHash) {
          const { error } = await withTimeout(
            client.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }),
            "Tempo esgotado ao validar o token de recuperação.",
          );
          if (error) throw error;
          cleanRecoveryUrl();
          finish(await confirmCurrentSession());
          subscription.unsubscribe();
          return;
        }

        const session = await confirmCurrentSession();
        if (!authEventResolved) finish(session);
      } catch (error) {
        fail(error instanceof Error ? error.message : null);
      } finally {
        window.setTimeout(() => subscription.unsubscribe(), 250);
      }
    }

    prepareRecovery();

    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return hasRecoverySession && !loading && !saving && password.length >= 6 && password === confirmPassword;
  }, [confirmPassword, hasRecoverySession, loading, password, saving]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client) return;

    if (password.length < 6) {
      setMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas não conferem.");
      return;
    }

    setSaving(true);
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) {
      setSaving(false);
      setHasRecoverySession(false);
      setMessage("Este link de recuperação expirou ou é inválido.");
      return;
    }

    const { error } = await client.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setMessage(friendlyUpdateError(error.message));
      return;
    }

    await client.auth.signOut();
    setMessage("Senha atualizada com sucesso. Redirecionando para login...");
    setTimeout(() => router.replace("/login"), 900);
  };

  const inputClass = "w-full rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 pr-12 text-sm text-[#eef5f1] outline-none transition placeholder:text-[#56645d] focus:border-[#b7f34a] focus:ring-2 focus:ring-[#b7f34a]/20";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] px-5 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-[#33413a] bg-[#101613]/95 p-8 text-[#e8efeb] shadow-2xl shadow-black/40 backdrop-blur">
        <div className="mb-7 flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d] shadow-lg shadow-[#b7f34a]/20"><Box size={22} /></div>
          <div>
            <div className="text-base font-black tracking-[.12em]">VectorCAD</div>
            <div className="mt-1 text-[11px] text-[#84938b]">Redefinição de senha</div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-[#26312c] bg-[#0b100e] p-4">
          <div className="flex items-center gap-2 text-sm font-black text-[#b7f34a]"><LockKeyhole size={16} /> Link seguro</div>
          <p className="mt-2 text-xs leading-5 text-[#8c9a93]">{message}</p>
        </div>

        <label className="mb-4 block text-xs font-bold text-[#aab8b1]">Nova senha
          <div className="relative mt-2">
            <input value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} type={showPassword ? "text" : "password"} placeholder="Digite a nova senha" required minLength={6} disabled={loading || !hasRecoverySession} />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#8d9a93] transition hover:bg-[#17221c] hover:text-[#b7f34a]">
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <label className="mb-5 block text-xs font-bold text-[#aab8b1]">Confirmar senha
          <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 text-sm text-[#eef5f1] outline-none transition placeholder:text-[#56645d] focus:border-[#b7f34a] focus:ring-2 focus:ring-[#b7f34a]/20" type={showPassword ? "text" : "password"} placeholder="Repita a nova senha" required minLength={6} disabled={loading || !hasRecoverySession} />
        </label>

        <button disabled={!canSubmit} className="w-full rounded-xl bg-[#b7f34a] py-3.5 text-sm font-black text-[#09120d] shadow-lg shadow-[#b7f34a]/10 transition hover:brightness-105 disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
}
