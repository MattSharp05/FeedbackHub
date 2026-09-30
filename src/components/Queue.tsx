import { Inbox, Search, Globe, Languages } from "lucide-react";
import { CATEGORIES, SOURCES, langName } from "@/data/constants";
import { ageLabel } from "@/lib/format";
import type { CategoryKey, FeedbackRequest, SourceKey } from "@/types";
import { CatTag, Confidence, SourceBadge, StatusPill, Tile } from "./primitives";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-[7px] border px-[11px] py-[5px] text-[12.5px] font-medium"
      style={{
        borderColor: active ? "#37352F" : "#E3E0DC",
        background: active ? "#37352F" : "#fff",
        color: active ? "#fff" : "#5F5B55",
      }}
    >
      {children}
    </button>
  );
}

export function Queue({
  activeApp,
  filtered,
  query,
  setQuery,
  catFilter,
  setCatFilter,
  sourceFilter,
  setSourceFilter,
  onOpen,
}: {
  activeApp: string | null;
  filtered: FeedbackRequest[];
  query: string;
  setQuery: (v: string) => void;
  catFilter: CategoryKey | null;
  setCatFilter: (v: CategoryKey | null) => void;
  sourceFilter: SourceKey | null;
  setSourceFilter: (v: SourceKey | null) => void;
  onOpen: (id: string) => void;
}) {
  const cats = Object.keys(CATEGORIES) as CategoryKey[];
  const sources = Object.keys(SOURCES) as SourceKey[];

  return (
    <>
      {/* header */}
      <div className="border-b border-[#ECEAE7] px-7 pb-[14px] pt-5">
        <div className="mb-[14px] flex items-center gap-2.5">
          {activeApp ? (
            <Tile name={activeApp} size={26} />
          ) : (
            <Inbox size={20} style={{ color: "#8A857F" }} />
          )}
          <h1 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">
            {activeApp || "All requests"}
          </h1>
          <span className="ml-0.5 text-[13px] text-[#A8A29A]">
            {filtered.length} items
          </span>
        </div>

        {/* source filter row */}
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="mr-1 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#9B968F]">
            Source
          </span>
          <FilterChip active={!sourceFilter} onClick={() => setSourceFilter(null)}>
            All sources
          </FilterChip>
          {sources.map((s) => {
            const S = SOURCES[s];
            const I = S.icon;
            const on = sourceFilter === s;
            if (!S.live) {
              return (
                <span
                  key={s}
                  className="inline-flex items-center gap-1.5 rounded-[7px] border border-dashed border-[#E3E0DC] px-[11px] py-[5px] text-[12.5px] font-medium text-[#B8B3AC]"
                >
                  <I size={13} />
                  {S.label} · Coming soon
                </span>
              );
            }
            return (
              <button
                key={s}
                onClick={() => setSourceFilter(on ? null : s)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] border px-[11px] py-[5px] text-[12.5px] font-medium"
                style={{
                  borderColor: on ? "#37352F" : "#E3E0DC",
                  background: on ? "#37352F" : "#fff",
                  color: on ? "#fff" : "#5F5B55",
                }}
              >
                <I size={13} style={{ color: on ? "#fff" : S.color }} />
                {S.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-[0_0_280px]">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "#B8B3AC" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search requests"
              className="box-border w-full rounded-lg border border-[#E3E0DC] bg-white py-[7px] pl-[30px] pr-2.5 text-[13px] text-[#37352F] outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-[5px]">
            <FilterChip active={!catFilter} onClick={() => setCatFilter(null)}>
              All
            </FilterChip>
            {cats.map((c) => (
              <FilterChip
                key={c}
                active={catFilter === c}
                onClick={() => setCatFilter(catFilter === c ? null : c)}
              >
                {CATEGORIES[c].label}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-7 py-[60px] text-center text-sm text-[#A8A29A]">
            Nothing here. Try clearing filters.
          </div>
        )}
        {filtered.map((q) => (
          <button
            key={q.id}
            onClick={() => onOpen(q.id)}
            className="flex w-full items-center gap-[14px] border-b border-[#F1EFEC] px-7 py-[13px] text-left transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F7F6F4")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            {!activeApp && <Tile name={q.app} size={26} />}
            <div className="min-w-0 flex-1">
              <div className="mb-[3px] flex items-center gap-[9px]">
                {!activeApp && (
                  <span className="text-[13.5px] font-semibold">{q.app}</span>
                )}
                <CatTag cat={q.category} />
                <SourceBadge source={q.source} />
                <span className="inline-flex items-center gap-1 text-[11.5px] text-[#A8A29A]">
                  <Globe size={11} /> {q.lang} · {q.country}
                </span>
                {q.translation && (
                  <span
                    className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-medium"
                    style={{ color: "#4F46E5", background: "#EEF0FB" }}
                  >
                    <Languages size={10} /> Translated
                  </span>
                )}
              </div>
              {/* Foreign-language requests are stacked: English translation on top,
                  original snippet muted below. English requests show a single line. */}
              <div className="max-w-[92%] overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] text-[#5F5B55]">
                {q.translation ?? q.message}
              </div>
              {q.translation && (
                <div className="mt-[3px] max-w-[92%] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[#A8A29A]">
                  <span className="text-[#B8B3AC]">
                    {langName(q.lang)} original ·{" "}
                  </span>
                  {q.message}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <StatusPill status={q.status} />
              <div className="flex items-center gap-2.5">
                <Confidence value={q.confidence} />
                <span className="w-[52px] text-right text-[11.5px] text-[#B8B3AC]">
                  {ageLabel(q.ageMin)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
