import { COPY } from "@/lib/copy";

export default function Footer() {
  return (
    <footer className="border-t border-line px-5 py-8 mt-auto">
      <div className="max-w-lg mx-auto">
        <p className="text-[11px] leading-relaxed text-smoke/80 mb-6">{COPY.footer.disclaimer}</p>
        <div className="flex flex-col gap-1 font-mono text-[11px] tracking-[0.08em] uppercase text-smoke">
          <span className="text-bone">{COPY.footer.name}</span>
          <a href={COPY.footer.emailHref} className="hover:text-bone transition-colors normal-case w-fit">
            {COPY.footer.email}
          </a>
        </div>
      </div>
    </footer>
  );
}
