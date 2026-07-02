import { Inbox, AlertTriangle, TrendingUp, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CATEGORIES } from "@/data/constants";
import { INSIGHTS } from "@/data/requests";
import type { CategoryKey, FeedbackRequest } from "@/types";
import { CatTag, Tile } from "./primitives";

interface Stats {
  total: number;
  auto: number;
  needs: number;
  byCat: Partial<Record<CategoryKey, number>>;
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[10px] border border-[#ECEAE7] bg-white px-4 py-[14px]">
      <div className="mb-[7px] text-[12.5px] text-[#8A857F]">{label}</div>
      <div
        className="mb-1.5 text-[27px] font-semibold leading-none tracking-[-0.02em]"
        style={{ color: accent || "#37352F" }}
      >
        {value}
      </div>
      <div className="text-[11.5px] text-[#A8A29A]">{sub}</div>
    </div>
  );
}

function Section({
  title,
  icon: I,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-[7px]">
        <I size={14.5} style={{ color: "#8A857F" }} />
        <h2 className="m-0 text-[13.5px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function Overview({
  stats,
  onOpenApp,
  onGoQueue,
}: {
  stats: Stats;
  requests: FeedbackRequest[];
  onOpenApp: (app: string) => void;
  onGoQueue: () => void;
}) {
  const autoPct = Math.round((stats.auto / stats.total) * 100);

  const catRows = (Object.entries(stats.byCat) as [CategoryKey, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  const maxCat = Math.max(...catRows.map((c) => c[1]));

  return (
    <div className="overflow-y-auto px-[34px] pb-[60px] pt-[26px]">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="m-0 text-[23px] font-semibold tracking-[-0.02em]">
          Overview
        </h1>
        <button
          onClick={onGoQueue}
          className="inline-flex cursor-pointer items-center gap-[5px] rounded-[7px] border border-[#E3E0DC] bg-white px-3 py-1.5 text-[13px] font-medium text-[#37352F]"
        >
          <Inbox size={14} /> Open full queue
        </button>
      </div>
      <p className="m-0 mb-6 text-[13.5px] text-[#8A857F]">
        All apps · last 24 hours · 3 sources connected
      </p>

      {/* stat cards */}
      <div className="mb-[26px] grid grid-cols-3 gap-3">
        <Stat label="Incoming requests" value={stats.total} sub="across 28 apps" />
        <Stat
          label="Needs attention"
          value={stats.needs}
          sub="new, unhandled"
          accent="#B45309"
        />
        <Stat
          label="Auto-handled"
          value={`${autoPct}%`}
          sub={`${stats.auto} of ${stats.total} resolved`}
          accent="#0F766E"
        />
      </div>

      <div className="grid grid-cols-[1.15fr_0.85fr] gap-5">
        {/* needs attention / insights */}
        <Section title="Needs attention" icon={AlertTriangle}>
          {INSIGHTS.map((ins, i) => (
            <button
              key={i}
              onClick={() => onOpenApp(ins.app)}
              className="mb-2 flex w-full cursor-pointer items-start gap-[11px] rounded-[9px] border border-[#ECEAE7] bg-white px-3 py-3 text-left transition-colors"
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "#D9D5D0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "#ECEAE7")
              }
            >
              <span
                className="mt-px h-[7px] w-[7px] shrink-0 rounded-full"
                style={{
                  background:
                    ins.sev === "high"
                      ? "#DC2626"
                      : ins.sev === "med"
                        ? "#F59E0B"
                        : "#9CA3AF",
                }}
              />
              <span className="flex-1">
                <span className="mb-[3px] flex items-center gap-2">
                  <Tile name={ins.app} size={17} />
                  <span className="text-[13px] font-semibold">{ins.app}</span>
                  <CatTag cat={ins.cat} />
                </span>
                <span className="text-[13px] leading-[1.45] text-[#5F5B55]">
                  {ins.text}
                </span>
              </span>
              <ChevronRight
                size={15}
                style={{ color: "#B8B3AC" }}
                className="mt-0.5"
              />
            </button>
          ))}
        </Section>

        {/* volume by category */}
        <Section title="Volume by category" icon={TrendingUp}>
          <div className="px-0.5 py-1">
            {catRows.map(([cat, n]) => (
              <div key={cat} className="mb-2.5 flex items-center gap-2.5">
                <span className="w-24 shrink-0">
                  <CatTag cat={cat} />
                </span>
                <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-[#EFEDEA]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(n / maxCat) * 100}%`,
                      background: CATEGORIES[cat].tone,
                      opacity: 0.8,
                    }}
                  />
                </span>
                <span className="w-[18px] text-right text-[12.5px] tabular-nums text-[#8A857F]">
                  {n}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
