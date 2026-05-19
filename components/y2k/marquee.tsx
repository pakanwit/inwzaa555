export function Marquee({
  children,
  speed = 40,
}: {
  children: React.ReactNode;
  speed?: number;
}) {
  return (
    <div className="overflow-hidden whitespace-nowrap bevel-in bg-y2k-chrome-100 py-1">
      <span
        className="inline-block pl-full animate-[marquee_linear_infinite]"
        style={{ animationDuration: `${speed}s` }}
      >
        {children}
      </span>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0%); }
          to   { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
