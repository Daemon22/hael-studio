import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRightLeft, GitBranch, LoaderCircle, Plus, RefreshCw, Sparkles, Workflow } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { StudioShell } from "@/shell/StudioShell";
import { TopBar } from "@/shell/TopBar";
import "@/orren-hub.css";

type DimensionValue = Record<string, unknown>;
type OrrenNode = {
  id: string; name: string; parentId: string | null; path: string; kind: string;
  behavior?: string; profile?: Record<string, number>; dimensionCounts?: Record<string, number>;
  dimensions?: Record<string, DimensionValue[]>;
};
type OrrenRelation = { id: string; from: string; to: string; type: string; label: string; intent: string };
type OrrenTarget = { id: string; name: string; language: string; capabilities: string[]; needsBridge: string[]; outputFiles: { path: string }[]; degradationCount: number; planState: string; emitted: boolean };
type OrrenEvent = { title: string; description: string; nodeId: string | null; time: string; source: string };
type OrrenField = {
  runtime: { connected: boolean; engineVersion: string; mode: string; sourceFile: string; fingerprint: string; fingerprintType: string; codegenAvailable: boolean; codegenMessage: string; sessionOnly: boolean };
  rootId: string | null; focusId: string | null; nodes: OrrenNode[]; relations: OrrenRelation[];
  targets: OrrenTarget[]; availableTargets: { id: string; language: string; present: boolean }[];
  events: OrrenEvent[]; engineSummary: string;
};
type FieldResponse = { connected: true; projectId?: string; revision?: number; field: OrrenField };
type Tab = "tree" | "flow" | "dimensions" | "realization" | "provenance";
type StudioProject = { id: string; name: string; role: "owner" | "admin" | "editor" | "viewer" };
const dimensionNames = ["Expression", "Cognitive", "Vibe", "Spatial", "Temporal", "Relational", "Conditional", "Behavioral", "Equilibrium"];
function selectedProjectId(): string {
  try { return window.localStorage.getItem("hael.activeProjectId") ?? "default"; } catch { return "default"; }
}

function selectedProjectHeaders(projectId: string, json = false): Record<string, string> {
  const headers: Record<string, string> = json ? { "content-type": "application/json" } : {};
  if (projectId && projectId !== "default") headers["x-studio-project-id"] = projectId;
  return headers;
}

async function readField(projectId: string): Promise<FieldResponse> {
  const response = await fetch("/api/orren/field", { headers: selectedProjectHeaders(projectId) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Orren is unavailable.");
  return payload as FieldResponse;
}

async function applyAction({ projectId, revision, body }: { projectId: string; revision: number; body: Record<string, unknown> }): Promise<FieldResponse> {
  const response = await fetch("/api/orren/action", {
    method: "POST", headers: { ...selectedProjectHeaders(projectId, true), "if-match": `"${revision}"`, "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "The Orren action could not be applied.");
  return payload as FieldResponse;
}

export default function OrrenHub() {
  const [, params] = useRoute("/projects/:projectId/semantic");
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const [projectId, setProjectId] = useState(params?.projectId ?? selectedProjectId);
  const queryKey = ["orren", "field", projectId];
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: async (): Promise<StudioProject[]> => {
    const response = await fetch("/api/projects");
    if (!response.ok) throw new Error("Could not load your projects.");
    return response.json() as Promise<StudioProject[]>;
  } });
  const fieldQuery = useQuery({ queryKey, queryFn: () => readField(projectId), retry: false, refetchInterval: 15000 });
  const action = useMutation({
    mutationFn: (body: Record<string, unknown>) => applyAction({ projectId, revision: fieldQuery.data?.revision ?? 0, body }),
    onSuccess: (next) => client.setQueryData(queryKey, next),
    onError: () => { void client.invalidateQueries({ queryKey }); },
  });
  const [tab, setTab] = useState<Tab>("tree");
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [behavior, setBehavior] = useState("");
  const [moveParent, setMoveParent] = useState("");
  const [relationTarget, setRelationTarget] = useState("");
  const [relationType, setRelationType] = useState("feeds");
  const [realizationTarget, setRealizationTarget] = useState("web_interface");
  const field = fieldQuery.data?.field;
  const nodes = field?.nodes ?? [];
  const selectedNode = nodes.find((node) => node.id === selectedId) ?? nodes.find((node) => node.id === field?.focusId) ?? nodes[0];
  const children = useMemo(() => {
    const map = new Map<string | null, OrrenNode[]>();
    for (const node of nodes) map.set(node.parentId, [...(map.get(node.parentId) ?? []), node]);
    return map;
  }, [nodes]);

  useEffect(() => {
    if (field && !nodes.some((node) => node.id === selectedId)) setSelectedId(field.focusId ?? field.rootId ?? nodes[0]?.id ?? "");
  }, [field, nodes, selectedId]);

  const submit = (body: Record<string, unknown>) => action.mutate(body);
  const tabs: { id: Tab; label: string; icon: typeof Workflow }[] = [
    { id: "tree", label: "Semantic tree", icon: GitBranch },
    { id: "flow", label: "Flow graph", icon: Workflow },
    { id: "dimensions", label: "Dimensions", icon: Sparkles },
    { id: "realization", label: "Realization", icon: ArrowRightLeft },
    { id: "provenance", label: "Provenance", icon: RefreshCw },
  ];

  function renderTree(parentId: string | null, depth = 0, visited = new Set<string>()) {
    return (children.get(parentId) ?? []).map((node) => {
      if (visited.has(node.id)) return null;
      const nextVisited = new Set(visited).add(node.id);
      return <div className="orren-tree-branch" key={node.id}>
        <button className={`orren-tree-node ${selectedNode?.id === node.id ? "selected" : ""}`} style={{ paddingLeft: `${14 + depth * 17}px` }} onClick={() => setSelectedId(node.id)}>
          <span className="orren-tree-glyph">{node.kind === "Semantic root" ? "◈" : node.behavior ? "◉" : "◇"}</span><span><strong>{node.name}</strong><small>{node.kind}</small></span>
        </button>
        {renderTree(node.id, depth + 1, nextVisited)}
      </div>;
    });
  }

  return <StudioShell>
    <TopBar>
      <div className="orren-topbar"><Link href="/" className="orren-back"><ArrowLeft size={15} /> Studio</Link><span className="orren-brand-mark">O</span><div><strong>Orren Visual Hub</strong><small>Semantic field</small></div></div>
      <div className="orren-topbar-status"><select className="orren-project-select" aria-label="Active project" value={projectId} onChange={(event) => {
        const nextId = event.target.value;
        try { window.localStorage.setItem("hael.activeProjectId", nextId === "default" ? "" : nextId); } catch { /* Keep selection in memory for this view. */ }
        setProjectId(nextId);
        if (nextId !== "default") setLocation(`/projects/${encodeURIComponent(nextId)}/semantic`);
        else setLocation("/semantic");
      }}><option value="default">Select project…</option>{(projectsQuery.data ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>{field?.runtime.connected ? <><span className="orren-live-dot" /> Engine connected · v{field.runtime.engineVersion}{fieldQuery.data?.revision !== undefined ? ` · r${fieldQuery.data.revision}` : ""}</> : "Connecting to Orren"}</div>
      <Button variant="outline" size="sm" onClick={() => void fieldQuery.refetch()} disabled={fieldQuery.isFetching}><RefreshCw size={14} /> Refresh</Button>
    </TopBar>

    <main className="orren-hub-page">
      <div className="orren-page-heading"><div><span className="orren-eyebrow">Orren · live semantic workspace</span><h1>Meaning, made visible.</h1><p>Shape the SIR field, explore its nine dimensions, and inspect the engine’s realization plans.</p></div>{field && <div className="orren-field-meta"><span>{nodes.length} semantic nodes</span><span>{field.relations.length} relations</span><span>{field.targets.length} targets</span></div>}</div>

      {fieldQuery.isError && <section className="orren-notice error"><strong>Orren is not connected</strong><span>{fieldQuery.error instanceof Error ? fieldQuery.error.message : "Start the Orren Visual Hub service and try again."}</span><button onClick={() => void fieldQuery.refetch()}>Retry connection</button><small>Configure ORREN_SERVICE_URL for the Studio API. Local development defaults to 127.0.0.1:4173.</small></section>}
      {action.isError && <section className="orren-notice error"><strong>Action not applied</strong><span>{action.error instanceof Error ? action.error.message : "Orren rejected the action."}</span></section>}
      {field?.runtime.sessionOnly && <section className="orren-notice"><strong>Session-only semantic state</strong><span>Orren currently keeps edits in its running process. Restarting its service resets this field to the fixture.</span></section>}

      <nav className="orren-tabs" aria-label="Orren semantic views">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={15} />{label}</button>)}</nav>

      {fieldQuery.isLoading ? <div className="orren-loading"><LoaderCircle size={20} className="orren-spin" /> Loading the semantic field…</div> : field && <section className="orren-content-grid">
        <aside className="orren-tree-panel"><div className="orren-panel-heading"><div><span className="orren-eyebrow">Field structure</span><strong>Semantic tree</strong></div><span className="orren-count">{nodes.length}</span></div><div className="orren-tree-scroll">{renderTree(null)}{nodes.length === 0 && <p className="orren-empty">This field has no semantic nodes yet.</p>}</div><div className="orren-create-row"><input aria-label="New semantic node" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Name a semantic node" maxLength={48} onKeyDown={(event) => { if (event.key === "Enter" && newName.trim()) { submit({ action: "create", name: newName.trim(), parentId: selectedNode?.id }); setNewName(""); } }} /><button aria-label="Create semantic node" disabled={!newName.trim() || action.isPending} onClick={() => { submit({ action: "create", name: newName.trim(), parentId: selectedNode?.id }); setNewName(""); }}><Plus size={15} /></button></div></aside>

        <div className="orren-main-panel">
          <div className="orren-view-heading"><div><span className="orren-eyebrow">{tabs.find((item) => item.id === tab)?.label}</span><h2>{tab === "tree" ? "Explore the field" : tab === "flow" ? "Relationships in motion" : tab === "dimensions" ? "Nine dimensions, one node" : tab === "realization" ? "Plans and capability" : "Semantic history"}</h2></div>{action.isPending && <span className="orren-saving"><LoaderCircle size={13} className="orren-spin" /> Applying</span>}</div>

          {tab === "tree" && <div className="orren-overview-view"><div className="orren-selected-card"><span className="orren-node-symbol">◈</span><div><span className="orren-eyebrow">Selected semantic node</span><h3>{selectedNode?.name ?? "Select a node"}</h3><code>{selectedNode?.path ?? ""}</code><p>{selectedNode?.behavior || "No behavior recorded for this node yet."}</p></div></div><div className="orren-action-cards"><form onSubmit={(event) => { event.preventDefault(); if (selectedNode && behavior.trim()) { submit({ action: "behavior", nodeId: selectedNode.id, text: behavior.trim() }); setBehavior(""); } }}><label htmlFor="orren-behavior">Add a behavior</label><div><input id="orren-behavior" value={behavior} onChange={(event) => setBehavior(event.target.value)} placeholder="Describe what this node does" maxLength={180} /><button type="submit" disabled={!selectedNode || !behavior.trim() || action.isPending}>Add</button></div></form><form onSubmit={(event) => { event.preventDefault(); if (selectedNode && moveParent) submit({ action: "move", nodeId: selectedNode.id, parentId: moveParent }); }}><label htmlFor="orren-move-parent">Move under a new parent</label><div><select id="orren-move-parent" value={moveParent} onChange={(event) => setMoveParent(event.target.value)}><option value="">Choose parent</option>{nodes.filter((node) => node.id !== selectedNode?.id).map((node) => <option key={node.id} value={node.id}>{node.path}</option>)}</select><button type="submit" disabled={!selectedNode || !moveParent || action.isPending}>Move</button></div></form></div><div className="orren-source-card"><div><span className="orren-eyebrow">Current semantic source</span><strong>{field.runtime.sourceFile}</strong></div><span>{field.runtime.mode}</span></div></div>}

          {tab === "flow" && <div className="orren-flow-view">{field.relations.length ? field.relations.map((relation) => <article className="orren-relation-card" key={relation.id}><div><strong>{nodes.find((node) => node.id === relation.from)?.name ?? relation.from}</strong><span className="orren-relation-type">{relation.label}</span><strong>{nodes.find((node) => node.id === relation.to)?.name ?? relation.to}</strong></div><p>{relation.intent}</p></article>) : <div className="orren-empty-state"><Workflow size={22} /><strong>No typed relationships yet</strong><span>Select a source and target to add an explicit relationship.</span></div>}<form className="orren-relation-form" onSubmit={(event) => { event.preventDefault(); if (selectedNode && relationTarget) submit({ action: "relate", from: selectedNode.id, to: relationTarget, type: relationType }); }}><strong>Connect the selected node</strong><select value={relationType} onChange={(event) => setRelationType(event.target.value)}><option value="feeds">feeds</option><option value="triggers">triggers</option><option value="produces">produces</option><option value="depends_on">depends on</option></select><select value={relationTarget} onChange={(event) => setRelationTarget(event.target.value)}><option value="">Choose target</option>{nodes.filter((node) => node.id !== selectedNode?.id).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select><button disabled={!selectedNode || !relationTarget || action.isPending}>Connect</button></form></div>}

          {tab === "dimensions" && <div className="orren-dimensions-view">{dimensionNames.map((name) => { const count = selectedNode?.dimensionCounts?.[name] ?? 0; const values = selectedNode?.dimensions?.[name] ?? []; return <article key={name} className="orren-dimension-row"><div><span>{name}</span><strong>{count}</strong></div><div className="orren-dimension-track"><span style={{ width: `${Math.round((selectedNode?.profile?.[name] ?? 0) * 100)}%` }} /></div><details><summary>Inspect values ({values.length})</summary><pre>{JSON.stringify(values, null, 2)}</pre></details></article>; })}<p className="orren-footnote">The profile bars show normalized payload counts within this field. Orren does not model these as confidence scores.</p></div>}

          {tab === "realization" && <div className="orren-realization-view"><div className="orren-source-card"><div><span className="orren-eyebrow">Source generation</span><strong>{field.runtime.codegenAvailable ? "Available" : "Unavailable in this engine build"}</strong></div><span>{field.runtime.codegenMessage || "The current output is a realization plan."}</span></div><div className="orren-target-grid">{field.targets.map((target) => <article className="orren-target-card" key={target.id}><div><span className="orren-target-mark">◇</span><span className="orren-target-status">{target.planState}</span></div><h3>{target.name}</h3><p>{target.language}</p><small>{target.capabilities.join(" · ") || "No declared capabilities"}</small><footer><span>{target.outputFiles.length} planned paths</span><span>{target.degradationCount} gaps</span></footer><strong className="orren-no-output">{target.emitted ? "Artifacts emitted" : "Plan only · no source files emitted"}</strong></article>)}</div><div className="orren-target-controls"><select value={realizationTarget} onChange={(event) => setRealizationTarget(event.target.value)}>{field.availableTargets.map((target) => <option key={target.id} value={target.id}>{target.id} · {target.language}{target.present ? " · added" : ""}</option>)}</select><button onClick={() => submit({ action: "add_target", target: realizationTarget })} disabled={action.isPending || field.availableTargets.find((target) => target.id === realizationTarget)?.present}>Add target</button><button className="primary" onClick={() => submit({ action: "realize", nodeId: selectedNode?.id })} disabled={action.isPending}><RefreshCw size={14} /> Refresh plans</button></div></div>}

          {tab === "provenance" && <div className="orren-provenance-view"><div className="orren-source-card"><div><span className="orren-eyebrow">SIR fingerprint</span><strong>{field.runtime.fingerprint}</strong></div><span>{field.runtime.fingerprintType}</span></div><div className="orren-history-list">{field.events.map((event, index) => <article key={`${event.time}-${index}`}><span className="orren-history-dot" /><div><div><strong>{event.title}</strong><time>{event.time}</time></div><p>{event.description}</p><small>{event.source}{event.nodeId ? ` · ${nodes.find((node) => node.id === event.nodeId)?.name ?? event.nodeId}` : ""}</small></div></article>)}{!field.events.length && <div className="orren-empty-state"><RefreshCw size={22} /><strong>No semantic events yet</strong><span>Actions in this project will appear here.</span></div>}</div><p className="orren-footnote">{field.runtime.sessionOnly ? "This event trail belongs to the running Visual Hub process and may reset on restart." : "Orren restores this project history from its command log. Studio's project audit records who made authorized changes."} The fingerprint is a semantic graph signature, not a source-file hash.</p></div>}
        </div>

        <aside className="orren-inspector-panel"><div className="orren-panel-heading"><div><span className="orren-eyebrow">Field inspector</span><strong>{selectedNode?.name ?? "No selection"}</strong></div><span className="orren-inspector-glyph">{selectedNode?.kind === "Semantic root" ? "◈" : "◇"}</span></div>{selectedNode ? <><p className="orren-inspector-path">{selectedNode.path}</p><span className="orren-inspector-kind">{selectedNode.kind}</span><div className="orren-inspector-block"><span className="orren-eyebrow">Behavioral meaning</span><p>{selectedNode.behavior || "No behavioral payload."}</p></div><div className="orren-inspector-block"><span className="orren-eyebrow">Dimension coverage</span>{dimensionNames.map((name) => <div className="orren-mini-dimension" key={name}><span>{name}</span><strong>{selectedNode.dimensionCounts?.[name] ?? 0}</strong></div>)}</div></> : <p className="orren-empty">Select a semantic node to inspect its path and meaning.</p>}<div className="orren-inspector-footer"><span className="orren-live-dot" /> Connected to Orren Engine</div></aside>
      </section>}
      {field && <footer className="orren-footer"><span>Semantic session · {field.runtime.sessionOnly ? "in memory" : "persistent"}</span><span>{field.engineSummary.split("\n").slice(0, 2).join(" · ")}</span></footer>}
    </main>
  </StudioShell>;
}
