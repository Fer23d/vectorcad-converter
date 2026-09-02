const contactEmail = "contato@vetorcad.com.br";
const adMailto = `mailto:${contactEmail}?subject=${encodeURIComponent("Quero anunciar no VetorCAD")}&body=${encodeURIComponent("Olá, gostaria de receber informações sobre anúncios no VetorCAD.")}`;
const adItems = Array.from({ length: 8 }, (_, index) => index);

type AdSideBoxProps = {
  direction: "up" | "down";
  className?: string;
};

export function AdSideBox({ direction, className = "" }: AdSideBoxProps) {
  return (
    <aside className={`ad-side-box group hidden h-[430px] overflow-hidden rounded-[1.75rem] border border-[#26382e] bg-[#0a100d]/85 p-3 shadow-2xl shadow-black/25 transition duration-300 hover:border-[#b7f34a]/45 hover:shadow-[0_0_26px_rgba(183,243,74,.08)] xl:block ${className}`} aria-label="Espaço publicitário">
      <div className="relative h-full overflow-hidden rounded-[1.35rem] border border-[#1d2d24] bg-[linear-gradient(180deg,rgba(183,243,74,.07),transparent_26%,rgba(183,243,74,.04))]">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-[#0a100d] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-[#0a100d] to-transparent" />
        <div className={`ad-side-box-track flex flex-col items-center gap-5 py-5 ${direction === "up" ? "ad-side-box-track-up" : "ad-side-box-track-down"}`}>
          {[0, 1].map((group) => (
            <div key={group} className="flex flex-col items-center gap-5" aria-hidden={group === 1}>
              {adItems.map((item) => (
                <a key={`${group}-${item}`} href={adMailto} className="writing-vertical text-center text-[10px] font-black uppercase tracking-[.28em] text-[#b7f34a]/80 transition duration-300 hover:text-[#eaffbf] focus:outline-none focus:ring-2 focus:ring-[#b7f34a]/40">
                  ANUNCIE AQUI <span className="text-[#b7f34a]/35">•</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .writing-vertical {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }

        .ad-side-box-track {
          min-height: 200%;
          will-change: transform;
        }

        .ad-side-box-track-up {
          animation: vetorcad-ad-scroll-up 18s linear infinite;
        }

        .ad-side-box-track-down {
          animation: vetorcad-ad-scroll-down 18s linear infinite;
        }

        .ad-side-box:hover .ad-side-box-track {
          animation-play-state: paused;
        }

        @keyframes vetorcad-ad-scroll-up {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }

        @keyframes vetorcad-ad-scroll-down {
          from { transform: translateY(-50%); }
          to { transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ad-side-box-track-up,
          .ad-side-box-track-down {
            animation: none;
            transform: translateY(0);
          }
        }
      `}</style>
    </aside>
  );
}
