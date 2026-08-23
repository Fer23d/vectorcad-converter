"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Box, KeyRound, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

type MfaStatus = {
  isAdmin: boolean;
  currentLevel: string;
  nextLevel: string | null;
  verifiedFactors: number;
  setupRequired: boolean;
  challengeRequired: boolean;
  mfaSatisfied: boolean;
};

type EnrolledFactor = {
  id: string;
  qrCode: string;
};

async function sendMfaEvent(accessToken: string, eventType: string, reason?: string) {
  await fetch("/api/auth/mfa/event", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, reason, factorType: "totp" }),
  }).catch(() => undefined);
}

function safeSvgDataUrl(svg: string) {
  return `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`;
}

export function MfaSetup() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState("");
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [factor, setFactor] = useState<EnrolledFactor | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Validando MFA administrativo...");

  useEffect(() => {
    async function loadStatus() {
      const client = supabase;
      if (!isSupabaseConfigured || !client) {
        router.replace("/login");
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      setAccessToken(session.access_token);
      const response = await fetch("/api/auth/mfa/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Não foi possível validar MFA.");
        setLoading(false);
        return;
      }

      setStatus(payload as MfaStatus);
      setMessage(payload.mfaSatisfied ? "MFA confirmado. Acesso administrativo liberado." : "Configure ou confirme seu MFA para acessar o Admin.");
      setLoading(false);
    }

    loadStatus();
  }, [router]);

  const startSetup = async () => {
    const client = supabase;
    if (!client || !accessToken) return;
    setLoading(true);
    await sendMfaEvent(accessToken, "MFA_SETUP_STARTED");
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "VetorCAD Admin" });
    setLoading(false);

    if (error || !data?.id || !data.totp?.qr_code) {
      await sendMfaEvent(accessToken, "MFA_SETUP_FAILED", error?.name || "ENROLL_FAILED");
      setMessage("Não foi possível iniciar o MFA. Tente novamente.");
      return;
    }

    setFactor({ id: data.id, qrCode: data.totp.qr_code });
    setFactorId(data.id);
    setMessage("Escaneie o QR Code no aplicativo autenticador e informe o código.");
  };

  const startChallenge = async (targetFactorId?: string) => {
    const client = supabase;
    const selectedFactorId = targetFactorId || factorId;
    if (!client || !accessToken || !selectedFactorId) return;
    setLoading(true);
    const { data, error } = await client.auth.mfa.challenge({ factorId: selectedFactorId });
    setLoading(false);

    if (error || !data?.id) {
      await sendMfaEvent(accessToken, "MFA_FAILED", error?.name || "CHALLENGE_FAILED");
      setMessage("Não foi possível criar o desafio MFA.");
      return;
    }

    await sendMfaEvent(accessToken, "MFA_CHALLENGE_REQUESTED");
    setChallengeId(data.id);
    setFactorId(selectedFactorId);
    setMessage("Digite o código do aplicativo autenticador.");
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = supabase;
    if (!client || !accessToken || !factorId || !challengeId || code.trim().length < 6) return;
    setLoading(true);
    const { error } = await client.auth.mfa.verify({ factorId, challengeId, code: code.trim() });
    setCode("");
    setLoading(false);

    if (error) {
      await sendMfaEvent(accessToken, "MFA_FAILED", error.name || "VERIFY_FAILED");
      setMessage("Código inválido ou expirado. Tente novamente.");
      return;
    }

    await sendMfaEvent(accessToken, factor ? "MFA_ENABLED" : "MFA_SUCCESS");
    const { data: sessionData } = await client.auth.getSession();
    const bridgeAccessToken = sessionData.session?.access_token || accessToken;
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: bridgeAccessToken }),
    }).catch(() => undefined);
    setMessage("MFA confirmado. Redirecionando para o Admin...");
    window.setTimeout(() => router.replace("/admin"), 900);
  };

  const disableMfa = async () => {
    const client = supabase;
    if (!client || !accessToken) return;
    const { data, error: listError } = await client.auth.mfa.listFactors();
    if (listError) {
      setMessage("Não foi possível listar fatores MFA.");
      return;
    }
    const verified = data.all.find((item) => item.factor_type === "totp" && item.status === "verified");
    if (!verified) {
      setMessage("Nenhum fator MFA verificado encontrado.");
      return;
    }
    setLoading(true);
    const { error } = await client.auth.mfa.unenroll({ factorId: verified.id });
    setLoading(false);
    if (error) {
      await sendMfaEvent(accessToken, "MFA_FAILED", error.name || "UNENROLL_FAILED");
      setMessage("Não foi possível desativar o MFA.");
      return;
    }
    await sendMfaEvent(accessToken, "MFA_DISABLED");
    await fetch("/api/auth/session", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
    await client.auth.signOut();
    setMessage("MFA desativado. Faça login novamente para continuar.");
    window.setTimeout(() => router.replace("/login"), 900);
  };

  const loadVerifiedFactor = async () => {
    const client = supabase;
    if (!client) return;
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) {
      setMessage("Não foi possível listar fatores MFA.");
      return;
    }
    const verified = data.all.find((item) => item.factor_type === "totp" && item.status === "verified");
    if (!verified) {
      setMessage("Nenhum fator verificado encontrado. Inicie a configuração.");
      return;
    }
    setFactorId(verified.id);
    await startChallenge(verified.id);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_-20%,#1d3428_0,#080c0b_42%)] px-5 py-10 text-[#e8efeb]">
      <section className="w-full max-w-lg rounded-3xl border border-[#33413a] bg-[#101613]/95 p-8 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="mb-7 flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#b7f34a] text-[#09120d] shadow-lg shadow-[#b7f34a]/20"><Box size={22} /></div>
          <div>
            <div className="text-base font-black tracking-[.12em]">VetorCAD</div>
            <div className="mt-1 text-[11px] text-[#84938b]">Segurança administrativa MFA</div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#26312c] bg-[#0b100e] p-4">
          <div className="flex items-center gap-2 text-sm font-black text-[#b7f34a]"><ShieldCheck size={16} /> MFA obrigatório para Admin</div>
          <p className="mt-2 text-xs leading-5 text-[#8c9a93]">{message}</p>
          {status && <p className="mt-3 text-[11px] text-[#6f7d75]">AAL atual: {status.currentLevel} · fatores verificados: {status.verifiedFactors}</p>}
        </div>

        {factor?.qrCode && (
          <div className="mt-6 rounded-2xl border border-[#b7f34a]/30 bg-white p-4">
            <Image unoptimized src={safeSvgDataUrl(factor.qrCode)} alt="QR Code MFA" width={224} height={224} className="mx-auto h-56 w-56" />
          </div>
        )}

        <div className="mt-6 grid gap-3">
          {!status?.mfaSatisfied && status?.setupRequired && !factor && (
            <button type="button" disabled={loading} onClick={startSetup} className="rounded-xl bg-[#b7f34a] px-5 py-3 text-sm font-black text-[#09120d] transition hover:brightness-105 disabled:opacity-60">
              Ativar MFA administrativo
            </button>
          )}

          {!status?.mfaSatisfied && status && !status.setupRequired && !challengeId && (
            <button type="button" disabled={loading} onClick={loadVerifiedFactor} className="rounded-xl bg-[#b7f34a] px-5 py-3 text-sm font-black text-[#09120d] transition hover:brightness-105 disabled:opacity-60">
              Confirmar MFA
            </button>
          )}

          {(factor || challengeId) && (
            <form onSubmit={verifyCode} className="grid gap-3">
              {factor && !challengeId && (
                <button type="button" disabled={loading} onClick={() => startChallenge(factor.id)} className="rounded-xl border border-[#b7f34a]/40 px-5 py-3 text-sm font-black text-[#b7f34a] transition hover:bg-[#b7f34a]/10 disabled:opacity-60">
                  Criar desafio MFA
                </button>
              )}
              {challengeId && (
                <>
                  <label className="block text-xs font-bold text-[#aab8b1]">Código MFA
                    <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} className="mt-2 w-full rounded-xl border border-[#34423c] bg-[#0b100e] px-4 py-3 text-sm text-[#eef5f1] outline-none transition placeholder:text-[#56645d] focus:border-[#b7f34a] focus:ring-2 focus:ring-[#b7f34a]/20" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required />
                  </label>
                  <button disabled={loading || code.length < 6} className="flex items-center justify-center gap-2 rounded-xl bg-[#b7f34a] px-5 py-3 text-sm font-black text-[#09120d] transition hover:brightness-105 disabled:opacity-60">
                    <KeyRound size={16} /> Verificar MFA
                  </button>
                </>
              )}
            </form>
          )}

          {status?.mfaSatisfied && (
            <>
              <button type="button" onClick={() => router.replace("/admin")} className="rounded-xl bg-[#b7f34a] px-5 py-3 text-sm font-black text-[#09120d] transition hover:brightness-105">
                Acessar Admin
              </button>
              <button type="button" disabled={loading} onClick={disableMfa} className="rounded-xl border border-[#34423c] px-5 py-3 text-sm font-black text-[#c9d7d0] transition hover:border-[#ff6961] hover:text-[#ffb4ae] disabled:opacity-60">
                Desativar MFA
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
