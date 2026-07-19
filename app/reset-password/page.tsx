import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir senha | vetorcad",
  description: "Crie uma nova senha segura para sua conta vetorcad.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
