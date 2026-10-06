import { useState } from "react";
import {
  X,
  Globe,
  Smartphone,
  CircleDot,
  Pencil,
  Send,
  Check,
  CircleCheck,
  RotateCcw,
  Languages,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SOURCES, STATUS_META, langName } from "@/data/constants";
import { ageLabel } from "@/lib/format";
import type { AutomationConfig, FeedbackRequest, RequestStatus } from "@/types";
import { CatTag, Confidence, SourceBadge } from "./primitives";
import { Tile } from "./primitives";

function Meta({ icon: I, text }: { icon?: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-[5px] rounded-md bg-[#F3F1EF] px-[9px] py-[3px] text-xs text-[#7A756E]">
      {I && <I size={12} />} {text}
    </span>
  );
}

function Label({
  children,
  nomargin = false,
}: {
  children: React.ReactNode;
  nomargin?: boolean;
}) {
  return (
    <div
      className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-[#9B968F]"
      style={{ marginBottom: nomargin ? 0 : 8 }}
    >
      {children}
    </div>
  );
}

const MODE_META = {
  auto: { label: "Auto-send", color: "#0F766E", bg: "#DBF1EE" },
  approve: { label: "Needs approval", color: "#B45309", bg: "#FCEFDB" },
  draft: { label: "Draft only", color: "#5F5B55", bg: "#EEECEA" },
} as const;

export function Detail({
  open,
  automation,
  onClose,
  onAct,
}: {
  open: FeedbackRequest;
  automation: AutomationConfig;
  onClose: () => void;
  onAct: (id: string, status: RequestStatus) => Promise<void>;
}) {
  const [draft, setDraft] = useState(open.draft);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = open.status === "resolved" || open.status === "rejected";

  // On success the parent closes the drawer, so only the failure path
  // touches local state.
  async function run(status: RequestStatus) {
    setBusy(true);
    setError(null);
    try {
      await onAct(open.id, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }
  const src = SOURCES[open.source];
  const SrcIcon = src.icon;
  const mode = automation[open.category];
  const modeMeta = MODE_META[mode];

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(30,28,25,0.18)]"
      />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-[540px] max-w-[92vw] flex-col border-l border-[#E3E0DC] bg-white"
        style={{ boxShadow: "-8px 0 28px rgba(30,28,25,0.10)" }}
      >
        {/* header */}
        <div className="flex items-center gap-[11px] border-b border-[#ECEAE7] px-[22px] py-4">
          <Tile name={open.app} size={26} />
          <div className="flex-1">
            <div className="text-[14.5px] font-semibold">{open.app}</div>
            <div className="flex items-center gap-[7px] text-xs text-[#A8A29A]">
              <SourceBadge source={open.source} withLabel /> ·{" "}
              {ageLabel(open.ageMin)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer p-1 text-[#8A857F]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-[22px] py-5">
          {/* meta row */}
          <div className="mb-[18px] flex flex-wrap gap-[7px]">
            <CatTag cat={open.category} />
            <Meta icon={Globe} text={`${open.lang} · ${open.country}`} />
            {open.device && <Meta icon={Smartphone} text={open.device} />}
            <Meta text={`v${open.appVersion}`} />
            {open.screen && <Meta text={open.screen} />}
          </div>

          {/* original message — for non-English, the English translation shows
              on top and the original is stacked below, muted. */}
          <Label>User message</Label>
          <div className="mb-[22px] rounded-[10px] border border-[#ECEAE7] bg-[#F7F6F4] px-[15px] py-[13px] text-sm leading-[1.55] text-[#37352F]">
            {open.translation ? (
              <>
                <div>{open.translation}</div>
                <div className="mt-3 flex items-center gap-1.5 border-t border-[#E7E4E0] pt-[10px] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#A8A29A]">
                  <Languages size={12} /> {langName(open.lang)} original
                </div>
                <div className="mt-1.5 text-[13px] leading-[1.55] text-[#8A857F]">
                  {open.message}
                </div>
              </>
            ) : (
              open.message
            )}
          </div>

          {/* AI classification */}
          <div className="mb-2 flex items-center justify-between">
            <Label nomargin>AI classification</Label>
            <Confidence value={open.confidence} />
          </div>
          <div className="mb-5 flex gap-2">
            <CatTag cat={open.category} />
            <span className="text-[12.5px] text-[#8A857F]">
              · {open.lang} detected
            </span>
          </div>

          {/* action item */}
          <Label>Action item</Label>
          <div className="mb-[22px] flex gap-[9px] rounded-[10px] border border-[#F4E4C4] bg-[#FFF9EE] px-[14px] py-3">
            <CircleDot
              size={15}
              style={{ color: "#C2820C" }}
              className="mt-px shrink-0"
            />
            <span className="text-[13.5px] leading-[1.5] text-[#7A5B12]">
              {open.action || "Not generated yet — AI triage isn't connected."}
            </span>
          </div>

          {/* draft reply */}
          <div className="mb-2 flex items-center justify-between">
            <Label nomargin>Suggested reply</Label>
            <span
              className="rounded-[5px] px-2 py-0.5 text-[11px] font-semibold"
              style={{ color: modeMeta.color, background: modeMeta.bg }}
            >
              {modeMeta.label}
            </span>
          </div>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={7}
              className="box-border w-full resize-y rounded-[10px] border border-[#B7C7EE] bg-white px-[15px] py-[13px] font-[inherit] text-sm leading-[1.55] text-[#37352F] outline-none"
            />
          ) : (
            <div className="whitespace-pre-wrap rounded-[10px] border border-[#DCE6FB] bg-[#F4F7FE] px-[15px] py-[13px] text-sm leading-[1.55] text-[#2C3A57]">
              {draft || (
                <span className="text-[#8A95AD]">
                  No draft yet — AI drafting isn't connected. Use Edit reply to
                  write one.
                </span>
              )}
            </div>
          )}
          {/* English gloss of the in-language reply, so an approver can read what
              they're sending. The reply itself (above) is what gets delivered. */}
          {open.draftTranslation && !editing && (
            <div className="mt-2.5 rounded-[10px] border border-[#ECEAE7] bg-[#F7F6F4] px-[15px] py-[11px]">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#A8A29A]">
                <Languages size={12} /> English translation
              </div>
              <div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-[1.55] text-[#8A857F]">
                {open.draftTranslation}
              </div>
            </div>
          )}
          <button
            onClick={() => setEditing((v) => !v)}
            className="mt-2 inline-flex cursor-pointer items-center gap-[5px] border-none bg-transparent p-0 text-[12.5px] text-[#5B6B8C]"
          >
            <Pencil size={12} /> {editing ? "Done editing" : "Edit reply"}
          </button>

          {/* delivery destination */}
          <div className="mt-4 flex items-center gap-[7px] rounded-lg border border-[#ECEAE7] bg-[#F7F6F4] px-3 py-[9px] text-[12.5px] text-[#7A756E]">
            <SrcIcon size={14} style={{ color: src.color }} className="shrink-0" />
            <span>
              Delivered via{" "}
              <span className="font-medium text-[#42403B]">{src.deliverVia}</span>
            </span>
            {src.note && (
              <span className="ml-auto whitespace-nowrap rounded-[5px] bg-[#FCEFDB] px-2 py-0.5 text-[11.5px] text-[#B45309]">
                {src.note}
              </span>
            )}
          </div>
        </div>

        {/* action bar */}
        <div className="border-t border-[#ECEAE7] bg-[#FBFAF9] px-[22px] py-[14px]">
          {error && (
            <div className="mb-2.5 rounded-md bg-[#FDF3F3] px-2.5 py-1.5 text-[12px] text-[#B91C1C]">
              Couldn't update: {error}
            </div>
          )}
          <div className="flex items-center gap-[9px]">
            {open.status === "auto-handled" ? (
              <div className="flex items-center gap-[7px] text-[13px] text-[#0F766E]">
                <Check size={15} /> Auto-handled — reply already sent to user.
              </div>
            ) : closed ? (
              <>
                <span className="text-[13px] text-[#7A756E]">
                  Closed as{" "}
                  <span className="font-medium" style={{ color: STATUS_META[open.status].color }}>
                    {STATUS_META[open.status].label}
                  </span>
                </span>
                <button
                  onClick={() => run("new")}
                  disabled={busy}
                  className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E3E0DC] bg-white px-[13px] py-2 text-[13px] font-medium text-[#42403B] disabled:cursor-default disabled:opacity-50"
                >
                  <RotateCcw size={14} /> Reopen
                </button>
              </>
            ) : (
              <>
                <button
                  disabled
                  title="Reply sending isn't connected yet"
                  className="inline-flex cursor-default items-center gap-1.5 rounded-lg border-none bg-[#2563EB] px-[15px] py-2 text-[13px] font-semibold text-white opacity-40"
                >
                  <Send size={14} /> {src.sendLabel}
                </button>
                <button
                  onClick={() => run("approved")}
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E3E0DC] bg-white px-[13px] py-2 text-[13px] font-medium text-[#42403B] disabled:cursor-default disabled:opacity-50"
                >
                  <Check size={14} /> Approve only
                </button>
                <button
                  onClick={() => run("resolved")}
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E3E0DC] bg-white px-[13px] py-2 text-[13px] font-medium text-[#42403B] disabled:cursor-default disabled:opacity-50"
                >
                  <CircleCheck size={14} /> Mark resolved
                </button>
                <button
                  onClick={() => run("rejected")}
                  disabled={busy}
                  className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#F0D5D5] bg-white px-[13px] py-2 text-[13px] font-medium text-[#B91C1C] disabled:cursor-default disabled:opacity-50"
                >
                  <X size={14} /> Reject
                </button>
              </>
            )}
          </div>
          <div className="mt-2 text-[11.5px] text-[#A8A29A]">
            Reply sending isn't connected yet — nothing is sent to the user.
            {open.source === "chat" &&
              " Resolve, reject and reopen sync to support-desk."}
          </div>
        </div>
      </aside>
    </>
  );
}
