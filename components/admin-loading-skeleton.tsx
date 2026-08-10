"use client";

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[#1b2821] ${className}`} />;
}

export function AdminDashboardSkeleton({ message }: { message: string }) {
  return <main className="min-h-screen bg-[#080c0b] p-6 text-[#e8efeb]"><div className="mx-auto max-w-7xl"><div className="mb-8 flex items-center justify-between"><div><Block className="h-5 w-48" /><Block className="mt-3 h-3 w-32" /></div><Block className="h-10 w-36" /></div><div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Block key={index} className="h-28" />)}</div><div className="mt-6 rounded-3xl border border-[#26312c] bg-[#101613] p-5"><Block className="h-5 w-40" /><div className="mt-5 grid gap-3 md:grid-cols-3"><Block className="h-24" /><Block className="h-24" /><Block className="h-24" /></div><Block className="mt-5 h-40" /></div><p className="mt-5 text-center text-xs uppercase tracking-[.18em] text-[#b7f34a]">{message}</p></div></main>;
}

export function AdminFinanceSkeleton() {
  return <div className="mt-5 animate-pulse space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <Block key={index} className="h-24" />)}</div><div className="grid gap-5 lg:grid-cols-2"><Block className="h-44" /><Block className="h-44" /><Block className="h-44" /><Block className="h-44" /></div></div>;
}
