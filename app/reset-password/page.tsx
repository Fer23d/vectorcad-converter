import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir senha | VetorCAD",
  description: "Crie uma nova senha segura para sua conta VetorCAD.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
