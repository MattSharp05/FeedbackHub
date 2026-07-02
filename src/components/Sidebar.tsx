import { LayoutGrid, Inbox, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { APPS } from "@/data/constants";
import type { View } from "@/types";
import { Tile } from "./primitives";

function RailItem({
  icon: I,
  label,
  active,
  badge,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="mb-px flex w-full items-center gap-[9px] rounded-md px-2 py-1.5 text-left text-[13.5px] transition-colors"
      style={{
        background: active ? "#ECEAE6" : "transparent",
        color: active ? "#37352F" : "#5F5B55",
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "#F0EEEB";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <I size={16} style={{ color: active ? "#37352F" : "#8A857F" }} />
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-[#FCEFDB] px-[5px] text-[11px] font-semibold text-[#B45309]">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  view,
  activeApp,
  needs,
  pendingByApp,
  onOverview,
  onQueueAll,
  onAutomation,
  onSelectApp,
}: {
  view: View;
  activeApp: string | null;
  needs: number;
  pendingByApp: Record<string, number>;
  onOverview: () => void;
  onQueueAll: () => void;
  onAutomation: () => void;
  onSelectApp: (app: string) => void;
}) {
  return (
    <aside className="flex h-full w-[244px] shrink-0 flex-col border-r border-[#ECEAE7] bg-[#F7F6F4]">
      <div className="flex items-center gap-[9px] px-[14px] pb-[10px] pt-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#37352F] text-sm font-bold text-white">
          F
        </div>
        <div className="text-[14.5px] font-semibold tracking-[-0.01em]">
          Feedback Hub
        </div>
      </div>

      <nav className="px-2 pb-2 pt-1">
        <RailItem
          icon={LayoutGrid}
          label="Overview"
          active={view === "overview"}
          onClick={onOverview}
        />
        <RailItem
          icon={Inbox}
          label="Queue"
          active={view === "queue" && !activeApp}
          badge={needs}
          onClick={onQueueAll}
        />
        <RailItem
          icon={Zap}
          label="Automations"
          active={view === "automation"}
          onClick={onAutomation}
        />
      </nav>

      <div className="px-4 pb-[6px] pt-[10px] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#9B968F]">
        Apps
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {APPS.map((app) => {
          const count = pendingByApp[app] || 0;
          const isActive = activeApp === app;
          return (
            <button
              key={app}
              onClick={() => onSelectApp(app)}
              className="mb-px flex w-full items-center gap-[9px] rounded-md px-2 py-1.5 text-left text-[13.5px] text-[#42403B] transition-colors"
              style={{ background: isActive ? "#ECEAE6" : "transparent" }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "#F0EEEB";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <Tile name={app} size={20} />
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {app}
              </span>
              {count > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-[#FCEFDB] px-[5px] text-[11px] font-semibold text-[#B45309]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
