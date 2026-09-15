import { useMemo, useState, useSyncExternalStore } from "react";
import { Activity, Bug, ChevronDown, ChevronUp, Clock, Code2, ExternalLink, HeartPulse, Layers, Link, RefreshCw, X } from "lucide-react";
import { runtimeRegistry } from "@/runtime/registry";
import type { RuntimeHealth, RuntimeRecord, FeatureName, ChangeEvent } from "@/runtime/registry";

const healthLabel: Record<RuntimeHealth, string> = { healthy: "Healthy", degraded: "Degraded", broken: "Broken", unknown: "Unknown" };
function healthClass(health: RuntimeHealth) { return `runtime-health runtime-health-${health}`; }

const featureNames: FeatureName[] = ["shell", "home", "projects", "navigation", "lifecycle", "studio", "theme", "runtime", "unknown"];

export function DevRuntimeInspector() {
  const snapshot = useSyncExternalStore(runtimeRegistry.subscribe, runtimeRegistry.getSnapshot, runtimeRegistry.getSnapshot);
  const [open, setOpen] = useState(true);
  const [selectedId, setSelectedId] = useState("home");
  const [viewMode, setViewMode] = useState<"records" | "features">("records");
  const selected = snapshot.records.find((record) => record.id === selectedId) || snapshot.records[0];
  
  const features = useMemo(() => {
    const map = new Map<FeatureName, RuntimeRecord[]>();
    snapshot.records.forEach((record) => {
      const feature = record.feature || "unknown";
      if (!map.has(feature)) map.set(feature, []);
      map.get(feature)!.push(record);
    });
    return map;
  }, [snapshot.records]);

  const brokenCount = snapshot.records.filter((r) => r.health === "broken").length;
  const degradedCount = snapshot.records.filter((r) => r.health === "degraded").length;
  const overallHealth: RuntimeHealth = brokenCount > 0 ? "broken" : degradedCount > 0 ? "degraded" : "healthy";

  if (!open) return <button className="runtime-inspector-launch" onClick={() => setOpen(true)} title="Open live application inspector"><Activity size={15} /> Live</button>;
  
  return <aside className="runtime-inspector" aria-label="Living application inspector">
    <header>
      <div>
        <span className="runtime-kicker">Development runtime</span>
        <strong><HeartPulse size={14} /> Live application</strong>
      </div>
      <div className="runtime-header-controls">
        <button className={`runtime-view-toggle ${viewMode === "records" ? "active" : ""}`} onClick={() => setViewMode("records")} title="View by runtime records"><Code2 size={14} /></button>
        <button className={`runtime-view-toggle ${viewMode === "features" ? "active" : ""}`} onClick={() => setViewMode("features")} title="View by feature slices"><Layers size={14} /></button>
        <button onClick={() => setOpen(false)} aria-label="Close inspector"><X size={14} /></button>
      </div>
    </header>
    
    <div className="runtime-summary">
      <span className={healthClass(overallHealth)} />
      {snapshot.records.filter((record) => record.active).length} active · {brokenCount} broken · {degradedCount} degraded
    </div>
    
    {viewMode === "features" ? (
      <div className="runtime-features">
        {Array.from(features.entries()).map(([feature, records]) => (
          <FeatureGroup key={feature} feature={feature} records={records} selectedId={selectedId} onSelect={setSelectedId} />
        ))}
      </div>
    ) : (
      <div className="runtime-records">
        {snapshot.records.map((record) => (
          <button key={record.id} onClick={() => setSelectedId(record.id)} className={selected?.id === record.id ? "selected" : ""}>
            <span className={healthClass(record.health)} />
            <span><small>{record.layer}</small>{record.label}</span>
          </button>
        ))}
      </div>
    )}
    
    {selected && <RuntimeDetail record={selected} records={snapshot.records} lastChange={snapshot.lastChange} />}
  </aside>;
}

function FeatureGroup({ feature, records, selectedId, onSelect }: { feature: FeatureName; records: RuntimeRecord[]; selectedId: string; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const brokenCount = records.filter((r) => r.health === "broken").length;
  const featureHealth: RuntimeHealth = brokenCount > 0 ? "broken" : records.some((r) => r.health === "degraded") ? "degraded" : "healthy";
  
  return <div className="runtime-feature-group">
    <button className={`runtime-feature-header ${expanded ? "expanded" : ""}`} onClick={() => setExpanded(!expanded)}>
      <span className={healthClass(featureHealth)} />
      <span><strong>{feature}</strong> <small>{records.length} elements</small></span>
      <ChevronDown size={14} className={`runtime-feature-chevron ${expanded ? "rotated" : ""}`} />
    </button>
    {expanded && <div className="runtime-feature-records">
      {records.map((record) => (
        <button key={record.id} onClick={() => onSelect(record.id)} className={selectedId === record.id ? "selected" : ""}>
          <span className={healthClass(record.health)} />
          <span><small>{record.layer}</small>{record.label}</span>
        </button>
      ))}
    </div>}
  </div>;
}

function RuntimeDetail({ record, records, lastChange }: { record: RuntimeRecord; records: RuntimeRecord[]; lastChange?: ChangeEvent }) {
  const [expanded, setExpanded] = useState(true);
  const dependencies = useMemo(() => (record.dependsOn || []).map((id) => records.find((candidate) => candidate.id === id)).filter((item): item is RuntimeRecord => Boolean(item)), [record.dependsOn, records]);
  const dependents = useMemo(() => records.filter((candidate) => candidate.dependsOn?.includes(record.id)), [record.id, records]);
  const affectedBy = useMemo(() => (record.affects || []).map((id) => records.find((candidate) => candidate.id === id)).filter((item): item is RuntimeRecord => Boolean(item)), [record.affects, records]);
  const affectedRecords = useMemo(() => records.filter((candidate) => candidate.affects?.includes(record.id)), [record.id, records]);
  
  return <section className="runtime-detail">
    <button className="runtime-detail-toggle" onClick={() => setExpanded(!expanded)}>
      <span>Selected</span>
      {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
    </button>
    {expanded && <>
      <h2>{record.label}</h2>
      <p className={healthClass(record.health)}>
        {healthLabel[record.health]}
        {record.error && ` · ${record.error}`}
      </p>
      {record.detail && <p>{record.detail}</p>}
      
      <dl className="runtime-detail-grid">
        <dt>Health</dt><dd className={healthClass(record.health)}>{healthLabel[record.health]}</dd>
        {record.feature && <><dt>Feature</dt><dd>{record.feature}</dd></>}
        {record.runtimeId && <><dt>Runtime identity</dt><dd><code>{record.runtimeId}</code></dd></>}
        <dt>Layer</dt><dd>{record.layer}</dd>
        {record.source && <><dt>Source</dt><dd><ExternalLink size={12} /> {record.source}{record.symbol ? ` · ${record.symbol}` : ""}</dd></>}
        <dt>Version</dt><dd>{record.version}</dd>
        <dt>Active</dt><dd>{record.active ? "Yes" : "No"}</dd>
        <dt>Last change</dt><dd><Clock size={12} /> {new Date(record.changedAt).toLocaleTimeString()}</dd>
      </dl>
      
      {lastChange && lastChange.id === record.id && (
        <div className="runtime-change-info">
          <RefreshCw size={14} />
          <span>Change: {lastChange.type}</span>
          {lastChange.from && <span>From: {lastChange.from}</span>}
          {lastChange.to && <span>To: {lastChange.to}</span>}
          {lastChange.consequence && <span>Consequence: {lastChange.consequence}</span>}
        </div>
      )}
      
      <RuntimeList title="Depends on" records={dependencies} empty="No registered dependencies." />
      <RuntimeList title="Dependents" records={dependents} empty="No registered dependents." />
      {affectedBy.length > 0 && <RuntimeList title="Affects" records={affectedBy} empty="No registered affected elements." />}
      {affectedRecords.length > 0 && <RuntimeList title="Affected by" records={affectedRecords} empty="No elements that affect this." />}
      
      {record.health === "broken" && <div className="runtime-failure">
        <Bug size={14} /> Immediate runtime failure recorded. Correct the source, then Fast Refresh will re-register the recovered element.
        <button className="runtime-recover" onClick={() => runtimeRegistry.recover(record.id)}>Recover</button>
      </div>}
    </>}
  </section>;
}

function RuntimeList({ title, records, empty }: { title: string; records: RuntimeRecord[]; empty: string }) {
  return <div className="runtime-list">
    <span>{title}</span>
    {records.length ? records.map((record) => <p key={record.id}><i className={healthClass(record.health)} /><Link size={12} />{record.label}</p>) : <small>{empty}</small>}
  </div>;
}
