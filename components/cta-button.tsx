import Link from "next/link";

type CTAButtonProps = {
  href?: string;
  children?: React.ReactNode;
  className?: string;
};

export function CTAButton({ href = "/signup", children = "Comece a vetorização", className = "" }: CTAButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-2xl bg-[#b7f34a] px-6 py-4 text-sm font-black text-[#07100a] shadow-[0_0_32px_rgba(183,243,74,.16)] transition duration-300 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_0_42px_rgba(183,243,74,.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b7f34a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b09] ${className}`}
    >
      {children}
      <span className="ml-3 text-lg leading-none" aria-hidden="true">→</span>
    </Link>
  );
}
