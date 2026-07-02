import { CATEGORIES, SOURCES, STATUS_META, tileColor } from "@/data/constants";
import type { CategoryKey, SourceKey, RequestStatus } from "@/types";

export function Tile({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center font-semibold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        background: tileColor(name),
        fontSize: size * 0.46,
        letterSpacing: "-0.02em",
      }}
    >
      {name[0].toUpperCase()}
    </div>
  );
}

export function CatTag({ cat }: { cat: CategoryKey }) {
  const c = CATEGORIES[cat];
  return (
    <span
      className="whitespace-nowrap rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium"
      style={{ color: c.tone, background: c.bg }}
    >
      {c.label}
    </span>
  );
}

export function SourceBadge({
  source,
  withLabel = false,
}: {
  source: SourceKey;
  withLabel?: boolean;
}) {
  const s = SOURCES[source];
  const I = s.icon;
  return (
    <span className="inline-flex items-center gap-[5px] text-xs text-[#6B6762]">
      <I size={13} style={{ color: s.color }} />
      {withLabel && s.label}
    </span>
  );
}

export function StatusPill({ status }: { status: RequestStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-[5px] text-[11.5px] font-medium"
      style={{ color: m.color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: m.dot }}
      />
      {m.label}
    </span>
  );
}

export function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 95 ? "#15803D" : pct >= 85 ? "#B45309" : "#B91C1C";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1 w-[34px] overflow-hidden rounded-full bg-[#EAE7E3]">
        <span
          className="block h-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
      <span className="text-[11px] tabular-nums text-[#8A857F]">{pct}%</span>
    </span>
  );
}
