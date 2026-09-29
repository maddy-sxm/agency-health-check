export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur-md">
      <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/speedxmedia-logo.png"
          alt="SPEEDXMEDIA"
          width={2000}
          height={190}
          className="h-5 md:h-6 w-auto"
        />
      </div>
    </header>
  );
}
