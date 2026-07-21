"use client";

import { FormEvent, useState } from "react";

type ContactStatus = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setStatus("sending");
    setErrorMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          message: formData.get("message"),
          website: formData.get("website"),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar sua mensagem.");
      form.reset();
      setStatus("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível enviar sua mensagem.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#223028] bg-[#0d1411] p-6 shadow-2xl shadow-black/30 md:p-8">
      <h2 className="text-2xl font-black">Envie sua mensagem</h2>
      <p className="mt-3 text-sm leading-6 text-[#93a39b]">Preencha os campos abaixo e envie sua mensagem diretamente para nossa equipe.</p>
      <label className="mt-6 block text-xs font-black uppercase tracking-[.14em] text-[#b7f34a]">Nome<input name="name" required maxLength={120} autoComplete="name" className="mt-2 w-full rounded-2xl border border-[#304238] bg-[#050807] px-4 py-3 text-sm text-[#edf5f0] outline-none transition placeholder:text-[#617169] focus:border-[#b7f34a]" placeholder="Seu nome" /></label>
      <label className="mt-5 block text-xs font-black uppercase tracking-[.14em] text-[#b7f34a]">Email<input name="email" type="email" required maxLength={254} autoComplete="email" className="mt-2 w-full rounded-2xl border border-[#304238] bg-[#050807] px-4 py-3 text-sm text-[#edf5f0] outline-none transition placeholder:text-[#617169] focus:border-[#b7f34a]" placeholder="nome@empresa.com.br" /></label>
      <label className="mt-5 block text-xs font-black uppercase tracking-[.14em] text-[#b7f34a]">Mensagem<textarea name="message" required minLength={3} maxLength={5000} rows={6} className="mt-2 w-full resize-none rounded-2xl border border-[#304238] bg-[#050807] px-4 py-3 text-sm text-[#edf5f0] outline-none transition placeholder:text-[#617169] focus:border-[#b7f34a]" placeholder="Conte como podemos ajudar..." /></label>
      <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">Site<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {status === "success" && <p role="status" className="mt-4 rounded-xl border border-[#b7f34a]/40 bg-[#17231a] px-4 py-3 text-sm text-[#d9f6b4]">Mensagem enviada com sucesso.</p>}
      {status === "error" && <p role="alert" className="mt-4 rounded-xl border border-[#a85151]/50 bg-[#2a1717] px-4 py-3 text-sm text-[#ffb8b8]">{errorMessage}</p>}
      <button type="submit" disabled={status === "sending"} className="mt-6 w-full rounded-2xl bg-[#b7f34a] px-5 py-4 text-sm font-black text-[#07100a] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60">{status === "sending" ? "Enviando..." : status === "success" ? "Mensagem enviada com sucesso" : "Enviar mensagem"}</button>
    </form>
  );
}

