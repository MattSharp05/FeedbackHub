import { useMemo, useState } from "react";
import { DEFAULT_AUTOMATION } from "@/data/constants";
import { REQUESTS } from "@/data/requests";
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

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [automation, setAutomation] =
    useState<AutomationConfig>(DEFAULT_AUTOMATION);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<CategoryKey | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceKey | null>(null);
  const [requests, setRequests] = useState<FeedbackRequest[]>(REQUESTS);

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

  function act(id: number, status: RequestStatus) {
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
        {view === "overview" && (
          <Overview
            stats={stats}
            requests={requests}
            onOpenApp={(a) => {
              setActiveApp(a);
              setView("queue");
            }}
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
