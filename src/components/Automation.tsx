import { CATEGORIES } from "@/data/constants";
import type { AutomationConfig, CategoryKey, TrustMode } from "@/types";
import { CatTag } from "./primitives";

interface Stats {
  byCat: Partial<Record<CategoryKey, number>>;
}

const MODES: { key: TrustMode; label: string; desc: string; color: string }[] = [
  {
    key: "draft",
    label: "Draft only",
    desc: "AI writes a draft. Nothing is sent without you.",
    color: "#5F5B55",
  },
  {
    key: "approve",
    label: "Human approval",
    desc: "AI drafts; a person approves before it sends.",
    color: "#B45309",
  },
  {
    key: "auto",
    label: "Auto-send",
    desc: "High-confidence replies send automatically.",
    color: "#0F766E",
  },
];

export function Automation({
  automation,
  setAutomation,
  stats,
}: {
  automation: AutomationConfig;
  setAutomation: React.Dispatch<React.SetStateAction<AutomationConfig>>;
  stats: Stats;
}) {
  const cats = Object.keys(CATEGORIES) as CategoryKey[];

  return (
    <div className="max-w-[760px] overflow-y-auto px-[34px] pb-[60px] pt-[26px]">
      <h1 className="m-0 mb-1 text-[23px] font-semibold tracking-[-0.02em]">
        Automations
      </h1>
      <p className="m-0 mb-2 text-[13.5px] leading-[1.5] text-[#8A857F]">
        Choose how much the system does on its own, per category. Start with
        everything in approval, then graduate a category to auto-send once you
        trust its accuracy. Sensitive topics like refunds and billing can stay
        human-gated indefinitely.
      </p>

      <div className="my-[26px] mt-[18px] flex gap-2.5">
        {MODES.map((m) => (
          <div
            key={m.key}
            className="flex-1 rounded-[10px] border border-[#ECEAE7] bg-white px-[14px] py-3"
          >
            <div className="mb-[5px] flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: m.color }}
              />
              <span className="text-[13px] font-semibold">{m.label}</span>
            </div>
            <div className="text-xs leading-[1.45] text-[#8A857F]">{m.desc}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#ECEAE7] bg-white">
        {cats.map((cat, i) => (
          <div
            key={cat}
            className="flex items-center px-[18px] py-[14px]"
            style={{ borderTop: i ? "1px solid #F1EFEC" : "none" }}
          >
            <div className="flex-1">
              <div className="flex items-center gap-[9px]">
                <CatTag cat={cat} />
                <span className="text-[12.5px] text-[#A8A29A]">
                  {stats.byCat[cat] || 0} this period
                </span>
              </div>
            </div>
            <div className="flex gap-1 rounded-[9px] bg-[#F3F1EF] p-[3px]">
              {MODES.map((m) => {
                const active = automation[cat] === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() =>
                      setAutomation((a) => ({ ...a, [cat]: m.key }))
                    }
                    className="cursor-pointer rounded-[7px] border-none px-3 py-[5px] text-xs font-medium"
                    style={{
                      background: active ? "#fff" : "transparent",
                      color: active ? m.color : "#8A857F",
                      boxShadow: active
                        ? "0 1px 2px rgba(0,0,0,0.06)"
                        : "none",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
