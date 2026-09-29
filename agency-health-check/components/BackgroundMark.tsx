/**
 * The chrome X mark, rendered faintly behind everything — same watermark
 * treatment RAP (revenue-activation-plan.speedxmedia.com) uses. Fixed so it
 * reads as a constant background texture rather than scrolling with the
 * page. The source image's own background is pure black (matches --ink),
 * so no alpha channel is needed — at low opacity the black just disappears
 * into the page background and only the chrome highlights read as a mark.
 */
export default function BackgroundMark() {
  return (
    <div
      className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/speedxmedia-x-mark.png"
        alt=""
        className="w-[130vmin] h-[130vmin] max-w-none opacity-[0.1] object-contain"
      />
    </div>
  );
}
