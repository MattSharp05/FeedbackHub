import { useEffect, useMemo, useState } from "react";
import { DEFAULT_AUTOMATION } from "@/data/constants";
import { fetchSupportDeskRequests } from "@/data/supportDesk";
import { loadAppStoreRequests } from "@/data/appStore";
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

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [automation, setAutomation] =
    useState<AutomationConfig>(DEFAULT_AUTOMATION);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<CategoryKey | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceKey | null>(null);
  const [requests, setRequests] = useState<FeedbackRequest[]>([]);
  const [loadingCount, setLoadingCount] = useState(INGESTION.length);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    for (const { label, load } of INGESTION) {
      load()
        .then(({ requests: live, warning }) => {
          if (cancelled) return;
          setRequests((rs) => [...rs, ...live]);
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
    const needs = requests.filter((q) => q.status === "new").length;
    const byCat: Partial<Record<CategoryKey, number>> = {};
    requests.forEach((q) => {
      byCat[q.category] = (byCat[q.category] || 0) + 1;
    });
    return { total, auto, needs, byCat };
  }, [requests]);

  function act(id: string, status: RequestStatus) {
    setRequests((rs) => rs.map((q) => (q.id === id ? { ...q, status } : q)));
    setOpenId(null);
  }

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
        {(loadingCount > 0 || failedSources.length > 0 || warnings.length > 0) && (
          <div
            className="border-b px-7 py-2 text-[12.5px]"
            style={
              failedSources.length > 0
                ? { borderColor: "#F0D5D5", background: "#FDF3F3", color: "#B91C1C" }
                : warnings.length > 0
                  ? { borderColor: "#F4E4C4", background: "#FFF9EE", color: "#7A5B12" }
                  : { borderColor: "#ECEAE7", background: "#F7F6F4", color: "#7A756E" }
            }
          >
            {failedSources.length > 0 &&
              `Couldn't load ${failedSources.join(" and ")} feedback — see the browser console. `}
            {warnings.join(" ")}{" "}
            {loadingCount > 0 && "Loading live feedback…"}
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
          open={open}
          automation={automation}
          onClose={() => setOpenId(null)}
          onAct={act}
        />
      )}
    </div>
  );
}
