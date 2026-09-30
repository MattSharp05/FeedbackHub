import { Inbox, AlertTriangle, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CATEGORIES, SOURCES } from "@/data/constants";
import type { CategoryKey, FeedbackRequest } from "@/types";
import { CatTag } from "./primitives";

const SOURCE_LIST = Object.values(SOURCES);
const LIVE_LABELS = SOURCE_LIST.filter((s) => s.live).map((s) => s.label);
const SOON_LABELS = SOURCE_LIST.filter((s) => !s.live).map((s) => s.label);

interface Stats {
  total: number;
  auto: number;
  needs: number;
  byCat: Partial<Record<CategoryKey, number>>;
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
  onGoQueue,
}: {
  stats: Stats;
  requests: FeedbackRequest[];
  onGoQueue: () => void;
}) {
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
        All apps · {LIVE_LABELS.join(" + ")} connected
        {SOON_LABELS.length > 0 && ` · ${SOON_LABELS.join(", ")} coming soon`}
      </p>

      <div className="grid grid-cols-[1.15fr_0.85fr] gap-5">
        {/* needs attention / insights */}
        <Section title="Needs attention" icon={AlertTriangle}>
          <div className="rounded-[9px] border border-dashed border-[#E3E0DC] bg-white px-3 py-4 text-[13px] leading-[1.45] text-[#8A857F]">
            <span className="font-semibold text-[#5F5B55]">Coming soon.</span>{" "}
            Emerging cross-app issues will be computed from live feedback once
            AI classification is connected.
          </div>
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
