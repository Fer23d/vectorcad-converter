import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Redefinir senha | VectorCAD",
  description: "Crie uma nova senha segura para sua conta VectorCAD.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
