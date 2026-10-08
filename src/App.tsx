import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_AUTOMATION } from "@/data/constants";
import { fetchSupportDeskRequests, syncSupportDeskStatus } from "@/data/supportDesk";
import { loadAppStoreRequests } from "@/data/appStore";
import { applyAi, classifyRequests, loadAiState, saveStatus, type AiState } from "@/data/enrichment";
import type {
  AutomationConfig,
  CategoryKey,
  FeedbackRequest,
  RequestStatus,
  SourceKey,
  View,
} from "@/types";
import { Sidebar } from "@/components/Sidebar";
import { Overview } from "@/components/Overview";
import { Queue } from "@/components/Queue";
import { Automation } from "@/components/Automation";
import { Detail } from "@/components/Detail";

const INGESTION: {
  label: string;
  load: () => Promise<{ requests: FeedbackRequest[]; warning?: string }>;
}[] = [
  { label: "In-app chat", load: async () => ({ requests: await fetchSupportDeskRequests() }) },
  { label: "App Store", load: loadAppStoreRequests },
];

// Matches the server's per-request limit in api/classify.ts.
const CLASSIFY_BATCH = 5;

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [automation, setAutomation] =
    useState<AutomationConfig>(DEFAULT_AUTOMATION);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<CategoryKey | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceKey | null>(null);
  // Requests as their sources report them (plus local status changes); AI
  // results and saved statuses are overlaid in `requests` below.
  const [sourceRequests, setSourceRequests] = useState<FeedbackRequest[]>([]);
  const [loadingCount, setLoadingCount] = useState(INGESTION.length);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [ai, setAi] = useState<AiState | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(0);
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    for (const { label, load } of INGESTION) {
      load()
        .then(({ requests: live, warning }) => {
          if (cancelled) return;
          setSourceRequests((rs) => [...rs, ...live]);
          if (warning) setWarnings((w) => [...w, warning]);
        })
        .catch((err: unknown) => {
          console.warn(`${label} ingestion failed`, err);
          if (!cancelled) setFailedSources((f) => [...f, label]);
        })
        .finally(() => {
          if (!cancelled) setLoadingCount((n) => n - 1);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadAiState()
      .then(setAi)
      .catch((err: unknown) => setAiError(String(err)));
  }, []);

  const requests = useMemo(
    () =>
      sourceRequests.map((q) => applyAi(q, ai?.enrichment[q.id], ai?.statuses[q.id])),
    [sourceRequests, ai],
  );

  // Classify open items that have no stored result yet, newest first, one
  // batch at a time. Each id is tried once per page load.
  useEffect(() => {
    if (!ai?.aiConfigured) return;
    const todo = requests
      .filter((q) => q.status === "new" && !ai.enrichment[q.id] && !attempted.current.has(q.id))
      .sort((a, b) => a.ageMin - b.ageMin);
    if (todo.length === 0) return;
    todo.forEach((q) => attempted.current.add(q.id));
    setClassifying((n) => n + todo.length);
    (async () => {
      for (let i = 0; i < todo.length; i += CLASSIFY_BATCH) {
        const batch = todo.slice(i, i + CLASSIFY_BATCH);
        try {
          const { enrichment, failed } = await classifyRequests(batch);
          setAi((a) => a && { ...a, enrichment: { ...a.enrichment, ...enrichment } });
          if (failed.length > 0) setAiError(`AI couldn't classify ${failed.length} item(s); they'll be retried on the next load.`);
        } catch (err) {
          setAiError(String(err));
        }
        setClassifying((n) => n - batch.length);
      }
    })();
  }, [requests, ai]);

  const pendingByApp = useMemo(() => {
    const m: Record<string, number> = {};
    requests.forEach((q) => {
      if (q.status === "new" || q.status === "drafted") {
        m[q.app] = (m[q.app] || 0) + 1;
      }
    });
    return m;
  }, [requests]);

  const filtered = useMemo(() => {
    return requests
      .filter((q) => {
        if (activeApp && q.app !== activeApp) return false;
        if (catFilter && q.category !== catFilter) return false;
        if (sourceFilter && q.source !== sourceFilter) return false;
        if (
          query &&
          !`${q.app} ${q.message} ${q.translation ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => a.ageMin - b.ageMin);
  }, [requests, activeApp, catFilter, sourceFilter, query]);

  const open = requests.find((q) => q.id === openId) ?? null;

  const stats = useMemo(() => {
    const total = requests.length;
    const auto = requests.filter((q) => q.status === "auto-handled").length;
    const needs = requests.filter((q) => q.status === "new" || q.status === "drafted").length;
    const byCat: Partial<Record<CategoryKey, number>> = {};
    requests.forEach((q) => {
      byCat[q.category] = (byCat[q.category] || 0) + 1;
    });
    return { total, auto, needs, byCat };
  }, [requests]);

  // Throws if a write-back fails; the local status only changes after the
  // source (and the database, when configured) accepted it.
  async function act(id: string, status: RequestStatus) {
    const target = requests.find((q) => q.id === id);
    if (target?.source === "chat") {
      await syncSupportDeskStatus(target.id, target.status, status);
    }
    if (ai?.dbConfigured) {
      await saveStatus(id, status);
      setAi((a) => a && { ...a, statuses: { ...a.statuses, [id]: status } });
    }
    setSourceRequests((rs) => rs.map((q) => (q.id === id ? { ...q, status } : q)));
    setOpenId(null);
  }

  const banner: { tone: "error" | "warn" | "info"; text: string }[] = [
    ...failedSources.map((s) => ({
      tone: "error" as const,
      text: `Couldn't load ${s} feedback — see the browser console.`,
    })),
    ...warnings.map((text) => ({ tone: "warn" as const, text })),
    ...(ai && !ai.aiConfigured
      ? [{ tone: "warn" as const, text: `AI classification isn't set up yet — add ${ai.missing.join(" and ")} in Vercel.` }]
      : []),
    ...(aiError ? [{ tone: "warn" as const, text: aiError }] : []),
    ...(loadingCount > 0 ? [{ tone: "info" as const, text: "Loading live feedback…" }] : []),
    ...(classifying > 0
      ? [{ tone: "info" as const, text: `AI is classifying and drafting replies for ${classifying} item(s)…` }]
      : []),
  ];
  const bannerTone = banner.some((b) => b.tone === "error")
    ? { borderColor: "#F0D5D5", background: "#FDF3F3", color: "#B91C1C" }
    : banner.some((b) => b.tone === "warn")
      ? { borderColor: "#F4E4C4", background: "#FFF9EE", color: "#7A5B12" }
      : { borderColor: "#ECEAE7", background: "#F7F6F4", color: "#7A756E" };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FBFAF9] text-[#37352F]">
      <Sidebar
        view={view}
        activeApp={activeApp}
        needs={stats.needs}
        pendingByApp={pendingByApp}
        onOverview={() => {
          setView("overview");
          setActiveApp(null);
        }}
        onQueueAll={() => {
          setView("queue");
          setActiveApp(null);
        }}
        onAutomation={() => setView("automation")}
        onSelectApp={(app) => {
          setActiveApp(app);
          setView("queue");
        }}
      />

      <main className="flex h-full flex-1 flex-col overflow-hidden">
        {banner.length > 0 && (
          <div className="border-b px-7 py-2 text-[12.5px]" style={bannerTone}>
            {banner.map((b) => b.text).join(" ")}
          </div>
        )}

        {view === "overview" && (
          <Overview
            stats={stats}
            requests={requests}
            onGoQueue={() => {
              setActiveApp(null);
              setView("queue");
            }}
          />
        )}

        {view === "queue" && (
          <Queue
            activeApp={activeApp}
            filtered={filtered}
            query={query}
            setQuery={setQuery}
            catFilter={catFilter}
            setCatFilter={setCatFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            onOpen={setOpenId}
          />
        )}

        {view === "automation" && (
          <Automation
            automation={automation}
            setAutomation={setAutomation}
            stats={stats}
          />
        )}
      </main>

      {open && (
        <Detail
          key={`${open.id}:${open.draft !== ""}`}
          open={open}
          automation={automation}
          onClose={() => setOpenId(null)}
          onAct={act}
        />
      )}
    </div>
  );
}
