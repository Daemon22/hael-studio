import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowRight, AudioLines, Check, ChevronDown, CircleHelp, Code2, Command, CornerDownLeft, Folder, GitBranch, HelpCircle, LoaderCircle, Mic, Plus, RefreshCw, Sparkles, SquareFunction, Terminal, Upload, Users, Workflow, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { StudioShell } from "@/shell/StudioShell";
import { TopBar } from "@/shell/TopBar";
import "@/integrated-workbench.css";

type StudioProject = { id: string; name: string; role: "owner" | "admin" | "editor" | "viewer" };
type OrrenNode = { id: string; name: string; parentId: string | null; path: string; kind: string; behavior?: string; dimensionCounts?: Record<string, number>; dimensions?: Record<string, Array<{ predicate?: string; value?: string; action?: string; condition?: string }>> };
type OrrenRelation = { id: string; from: string; to: string; type: string; label: string; intent: string };
type OrrenField = {
  runtime: { connected: boolean; engineVersion: string; mode: string; sourceFile: string; fingerprint: string; fingerprintType: string; codegenAvailable: boolean; codegenMessage: string; sessionOnly: boolean };
  rootId: string | null; focusId: string | null; nodes: OrrenNode[]; relations: OrrenRelation[]; targets: Array<{ id: string; name: string; planState: string; emitted: boolean }>;
};
type FieldResponse = { connected: true; projectId?: string; revision?: number; field: OrrenField };
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognizer = { lang: string; interimResults: boolean; maxAlternatives: number; onresult: ((event: SpeechResultEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start(): void; stop(): void };
type SpeechRecognizerConstructor = new () => SpeechRecognizer;
type TerminalSnapshot = { workspace: string; cwd: string; entries: Array<{ name: string; kind: "folder" | "file"; size?: number }> };
type TerminalCommandResult = { status: "confirmation_required" | "completed"; command: { action: string }; preview?: string; cwd?: string; message?: string };
type TerminalLine = { id: string; input: string; message: string; cwd: string; kind?: "error" | "confirm" };

function readActiveProject(): string {
  try { return window.localStorage.getItem("hael.activeProjectId") ?? ""; } catch { return ""; }
}

function readTerminalDirectory(projectId: string): string {
  try {
    const saved = window.localStorage.getItem(`hael.cwd.${projectId}`) ?? "";
    const legacyRoot = `/projects/${projectId}`;
    if (saved === legacyRoot) return "";
    if (saved.startsWith(`${legacyRoot}/`)) return saved.slice(legacyRoot.length + 1);
    return saved.startsWith("/") ? "" : saved;
  } catch { return ""; }
}

function projectHeaders(projectId: string, json = false): Record<string, string> {
  const headers: Record<string, string> = json ? { "content-type": "application/json" } : {};
  if (projectId && projectId !== "default") headers["x-studio-project-id"] = projectId;
  return headers;
}

async function fetchField(projectId: string): Promise<FieldResponse> {
  const response = await fetch("/api/orren/field", { headers: projectHeaders(projectId) });
  const body = await response.json() as FieldResponse | { error?: string };
  if (!response.ok || !("field" in body)) throw new Error("error" in body ? body.error ?? "Orren could not open this program." : "Orren could not open this program.");
  return body;
}

export default function IntegratedWorkbench() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const [projectId, setProjectId] = useState(readActiveProject);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [relationTarget, setRelationTarget] = useState("");
  const [relationType, setRelationType] = useState("triggers");
  const [instruction, setInstruction] = useState("");
  const [draftNodeName, setDraftNodeName] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [recognizer, setRecognizer] = useState<SpeechRecognizer | null>(null);
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalCwd, setTerminalCwd] = useState(() => readTerminalDirectory(projectId));
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [pendingCommand, setPendingCommand] = useState<{ input: string; cwd: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"instruction" | "terminal">("instruction");
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const archivePickerRef = useRef<HTMLInputElement>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<StudioProject[]> => {
      const response = await fetch("/api/projects");
      if (!response.ok) throw new Error("Could not load your projects.");
      return response.json() as Promise<StudioProject[]>;
    },
  });
  const projects = projectsQuery.data ?? [];
  const activeProject = projects.find((project) => project.id === projectId);
  useEffect(() => {
    if (!projects.length || projects.some((project) => project.id === projectId)) return;
    const firstProject = projects[0]!;
    setProjectId(firstProject.id);
    try { window.localStorage.setItem("hael.activeProjectId", firstProject.id); } catch { /* Keep the active project in component state. */ }
  }, [projectId, projects]);

  useEffect(() => {
    setTerminalCwd(readTerminalDirectory(projectId));
    setTerminalLines([]);
    setPendingCommand(null);
  }, [projectId]);

  useEffect(() => { terminalEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [terminalLines]);

  const fieldKey = ["orren", "field", projectId];
  const fieldQuery = useQuery({ queryKey: fieldKey, queryFn: () => fetchField(projectId), enabled: Boolean(projectId), retry: false, refetchInterval: 15000 });
  const terminalQuery = useQuery({
    queryKey: ["terminal", projectId, terminalCwd],
    queryFn: async (): Promise<TerminalSnapshot> => {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/terminal?cwd=${encodeURIComponent(terminalCwd)}`);
      const payload = await response.json() as TerminalSnapshot | { error?: string };
      if (!response.ok || !("entries" in payload)) throw new Error("error" in payload ? payload.error ?? "Could not open the project terminal." : "Could not open the project terminal.");
      return payload;
    },
    enabled: Boolean(projectId), retry: false,
  });
  const field = fieldQuery.data?.field;
  const nodes = field?.nodes ?? [];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes.find((node) => node.id === field?.focusId) ?? nodes[0];
  const selectedRelations = useMemo(() => field?.relations.filter((relation) => relation.from === selectedNode?.id || relation.to === selectedNode?.id) ?? [], [field?.relations, selectedNode?.id]);
  const selectedVariableType = selectedNode?.dimensions?.Cognitive?.find((item) => item.predicate === "type")?.value;
  const selectedRuleCondition = selectedNode?.dimensions?.Conditional?.find((item) => item.action === "activates")?.condition;

  useEffect(() => {
    if (field && !nodes.some((node) => node.id === selectedNodeId)) setSelectedNodeId(field.focusId ?? field.rootId ?? nodes[0]?.id ?? "");
  }, [field, nodes, selectedNodeId]);

  const action = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<FieldResponse> => {
      const response = await fetch("/api/orren/action", {
        method: "POST",
        headers: { ...projectHeaders(projectId, true), "if-match": `"${fieldQuery.data?.revision ?? 0}"`, "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as FieldResponse | { error?: string };
      if (!response.ok || !("field" in payload)) throw new Error("error" in payload ? payload.error ?? "Orren did not apply the change." : "Orren did not apply the change.");
      return payload;
    },
    onSuccess: (next) => {
      client.setQueryData(fieldKey, next);
      setInstruction("");
      setDraftNodeName("");
      setVoiceError("");
    },
    onError: () => { void client.invalidateQueries({ queryKey: fieldKey }); },
  });

  const terminalCommand = useMutation({
    mutationFn: async (input: { input: string; cwd: string; confirm?: boolean }): Promise<TerminalCommandResult> => {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/terminal/command`, {
        method: "POST", headers: { ...projectHeaders(projectId, true) }, body: JSON.stringify(input),
      });
      const payload = await response.json() as TerminalCommandResult | { error?: string };
      if (!response.ok || !("status" in payload)) throw new Error("error" in payload ? payload.error ?? "The command could not be completed." : "The command could not be completed.");
      return payload;
    },
    onSuccess: (result, variables) => {
      if (result.status === "confirmation_required") {
        setPendingCommand({ input: variables.input, cwd: variables.cwd });
        setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: variables.input, message: result.preview ?? "This action changes project files. Confirm to continue.", cwd: terminalQuery.data?.cwd ?? "", kind: "confirm" }]);
        return;
      }
      setPendingCommand(null);
      if (result.cwd !== undefined) {
        setTerminalCwd(result.cwd);
        try { window.localStorage.setItem(`hael.cwd.${projectId}`, result.cwd); } catch { /* Keep the path for the current session. */ }
      }
      setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: variables.input, message: result.message ?? "Done.", cwd: terminalQuery.data?.cwd ?? "" }]);
      void client.invalidateQueries({ queryKey: ["terminal", projectId] });
    },
    onError: (error, variables) => setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: variables.input, message: error instanceof Error ? error.message : "The command could not be completed.", cwd: terminalQuery.data?.cwd ?? "", kind: "error" }]),
  });

  const terminalOrrenAction = useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<FieldResponse> => {
      const response = await fetch("/api/orren/action", {
        method: "POST",
        headers: { ...projectHeaders(projectId, true), "if-match": `"${fieldQuery.data?.revision ?? 0}"`, "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as FieldResponse | { error?: string };
      if (!response.ok || !("field" in payload)) throw new Error("error" in payload ? payload.error ?? "Orren could not apply that program command." : "Orren could not apply that program command.");
      return payload;
    },
    onSuccess: (next, body) => {
      client.setQueryData(fieldKey, next);
      const descriptions: Record<string, string> = { create: "Added a program element to Orren.", variable: "Added the typed variable to Orren’s cognitive model.", rule: "Added the activation rule to Orren’s conditional model.", behavior: "Attached the behavior to the selected Orren element.", relate: "Connected the elements in Orren." };
      setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: String(body.__spokenCommand ?? ""), message: descriptions[String(body.action)] ?? "Orren updated the program model.", cwd: terminalQuery.data?.cwd ?? "" }]);
    },
    onError: (error, body) => setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: String(body.__spokenCommand ?? ""), message: error instanceof Error ? error.message : "Orren did not update the program model.", cwd: terminalQuery.data?.cwd ?? "", kind: "error" }]),
  });

  const uploadArchive = useMutation({
    mutationFn: async (file: File) => {
      const query = new URLSearchParams({ cwd: terminalCwd, name: file.name });
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/terminal/archive?${query}`, {
        method: "PUT", headers: { "content-type": "application/octet-stream" }, body: await file.arrayBuffer(),
      });
      const payload = await response.json() as { name?: string; error?: string };
      if (!response.ok || !payload.name) throw new Error(payload.error ?? "The archive could not be added to this project.");
      return payload;
    },
    onSuccess: ({ name }) => {
      setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: `add ${name}`, message: `Added ${name} to the current project folder. Run “unzip ${name}” when you are ready to extract it.`, cwd: terminalQuery.data?.cwd ?? "" }]);
      void client.invalidateQueries({ queryKey: ["terminal", projectId] });
    },
  });

  const changeDirectory = (path: string) => {
    if (!path) return;
    const fullInput = `cd ${path}`;
    terminalCommand.mutate({ input: fullInput, cwd: terminalCwd });
  };

  const startVoiceInput = (target: "instruction" | "terminal" = "instruction") => {
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognizerConstructor; webkitSpeechRecognition?: SpeechRecognizerConstructor };
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (target === "instruction") setVoiceError("Voice input is not available in this browser. You can still describe the behavior in words.");
      else setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: "", message: "Voice input is not available in this browser. You can still type a command.", cwd: terminalQuery.data?.cwd ?? "", kind: "error" }]);
      return;
    }
    if (listening) { recognizer?.stop(); setListening(false); return; }
    const next = new SpeechRecognition();
    next.lang = navigator.language || "en-ZA";
    next.interimResults = true;
    next.maxAlternatives = 1;
    setVoiceTarget(target);
    next.onresult = (event) => {
      const transcript = Array.from(event.results).slice(event.resultIndex).map((result) => result[0]?.transcript ?? "").join("");
      if (transcript) {
        if (target === "terminal") setTerminalInput(transcript);
        else setInstruction((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${transcript}`);
      }
    };
    next.onerror = () => { setListening(false); if (target === "instruction") setVoiceError("Voice capture ended. Your draft remains here so you can review it."); };
    next.onend = () => setListening(false);
    setRecognizer(next);
    setVoiceError("");
    setListening(true);
    next.start();
  };

  const submitTerminalCommand = (input = terminalInput, confirm = false) => {
    const value = input.trim();
    if (!value || terminalCommand.isPending || terminalOrrenAction.isPending) return;
    setTerminalInput("");
    if (!confirm) {
      setCommandHistory((history) => history.at(-1) === value ? history : [...history, value].slice(-100));
      setHistoryCursor(null);
      if (["help", "help orren", "commands"].includes(value.toLowerCase())) {
        setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: value, cwd: terminalQuery.data?.cwd ?? "", message: ["Project navigation: pwd · ls · cd <folder>", "Files: unzip <archive.zip> · git clone <owner/repository> (confirmation required)", "Program model: create element <name> · create variable <name> as <text|number|boolean|date|list|object>", "Logic: create rule <name> when <condition> · describe behavior: <intent>", "Relationships: connect <element> to <element> as <feeds|triggers|produces|depends on>", "Voice: press the microphone, review the transcript, then run it.", "Type clear to clear this terminal. This project shell is scoped to the current project; it does not run arbitrary shell scripts."].join("\n") }]);
        return;
      }
      if (value.toLowerCase() === "clear") { setTerminalLines([]); return; }
    }
    const semanticCommand = /^(?:create|add)\s+(?:a\s+)?(?:program\s+)?(?:element|concept|variable|rule|logic)\b|^(?:describe behavior|set behavior|add behavior|describe logic|set logic|describe rule|connect)\b|^(?:when|whenever|if|the program should|make it|it should)\b/i.test(value);
    if (!confirm && semanticCommand && !field) {
      setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: value, message: "Orren is offline, so I could not change the program model. Your workspace files are still available; reconnect Orren to use program commands.", cwd: terminalQuery.data?.cwd ?? "", kind: "error" }]);
      return;
    }
    if (!confirm && field) {
      const variableMatch = value.match(/^(?:create|add)\s+(?:a\s+)?(?:typed\s+)?variable\s+["']?(.+?)["']?\s+(?:as|of type)\s+(text|number|boolean|date|list|object)$/i);
      if (variableMatch?.[1] && variableMatch[2]) {
        terminalOrrenAction.mutate({ action: "variable", name: variableMatch[1].trim(), valueType: variableMatch[2].toLowerCase(), parentId: selectedNode?.id ?? field.rootId ?? undefined, __spokenCommand: value });
        return;
      }
      const ruleMatch = value.match(/^(?:create|add)\s+(?:a\s+)?(?:program\s+)?rule\s+["']?(.+?)["']?\s+(?:when|if)\s+(.+)$/i);
      if (ruleMatch?.[1] && ruleMatch[2]) {
        terminalOrrenAction.mutate({ action: "rule", name: ruleMatch[1].trim(), condition: ruleMatch[2].trim(), parentId: selectedNode?.id ?? field.rootId ?? undefined, __spokenCommand: value });
        return;
      }
      const createMatch = value.match(/^(?:create|add)\s+(?:a\s+)?(?:program\s+)?(?:element|concept)\s+(?:named\s+)?["']?(.+?)["']?$/i);
      if (createMatch?.[1]) {
        terminalOrrenAction.mutate({ action: "create", name: createMatch[1].trim(), parentId: selectedNode?.id ?? field.rootId ?? undefined, __spokenCommand: value });
        return;
      }
      const behaviorMatch = value.match(/^(?:describe behavior|set behavior|add behavior|describe logic|set logic|describe rule)\s*(?::|\bto\b|\bas\b)\s*(.+)$/i);
      if (behaviorMatch?.[1] && selectedNode) {
        terminalOrrenAction.mutate({ action: "behavior", nodeId: selectedNode.id, text: behaviorMatch[1].trim(), __spokenCommand: value });
        return;
      }
      if (/^(?:when|whenever|if|the program should|make it|it should)\b/i.test(value) && selectedNode) {
        terminalOrrenAction.mutate({ action: "behavior", nodeId: selectedNode.id, text: value, __spokenCommand: value });
        return;
      }
      const relationMatch = value.match(/^connect\s+["']?(.+?)["']?\s+to\s+["']?(.+?)["']?\s+(?:as|with|using)\s+(triggers|feeds|produces|depends on|depends_on)$/i);
      if (relationMatch) {
        const from = nodes.find((node) => node.id === relationMatch[1] || node.name.toLowerCase() === relationMatch[1]!.toLowerCase());
        const to = nodes.find((node) => node.id === relationMatch[2] || node.name.toLowerCase() === relationMatch[2]!.toLowerCase());
        if (from && to) {
          const relation = relationMatch[3]!.toLowerCase().replace(/ /g, "_");
          terminalOrrenAction.mutate({ action: "relate", from: from.id, to: to.id, type: relation, __spokenCommand: value });
          return;
        }
        setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: value, message: "I could not find both program elements by name. Check their names in Orren’s Program model.", cwd: terminalQuery.data?.cwd ?? "", kind: "error" }]);
        return;
      }
      if (/^(?:create|add)\s+(?:a\s+)?(?:program\s+)?(?:rule|logic)\b/i.test(value)) {
        setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: value, message: "Write a rule as “create rule NAME when CONDITION”, for example “create rule greet visitor when visitor arrives”.", cwd: terminalQuery.data?.cwd ?? "", kind: "error" }]);
        return;
      }
      if (/^(?:describe behavior|set behavior|add behavior|describe logic|set logic|describe rule)\b/i.test(value) && !selectedNode) {
        setTerminalLines((lines) => [...lines, { id: crypto.randomUUID(), input: value, message: "Select a program element in Orren before attaching behavior or logic.", cwd: terminalQuery.data?.cwd ?? "", kind: "error" }]);
        return;
      }
    }
    terminalCommand.mutate({ input: value, cwd: terminalCwd, ...(confirm ? { confirm: true } : {}) });
  };

  const applyInstruction = () => {
    if (!selectedNode || !instruction.trim() || action.isPending) return;
    const variableMatch = instruction.trim().match(/^(?:create|add)\s+(?:a\s+)?(?:typed\s+)?variable\s+["']?(.+?)["']?\s+(?:as|of type)\s+(text|number|boolean|date|list|object)$/i);
    if (variableMatch?.[1] && variableMatch[2]) {
      action.mutate({ action: "variable", name: variableMatch[1].trim(), valueType: variableMatch[2].toLowerCase(), parentId: selectedNode.id });
      return;
    }
    const ruleMatch = instruction.trim().match(/^(?:create|add)\s+(?:a\s+)?(?:program\s+)?rule\s+["']?(.+?)["']?\s+(?:when|if)\s+(.+)$/i);
    if (ruleMatch?.[1] && ruleMatch[2]) {
      action.mutate({ action: "rule", name: ruleMatch[1].trim(), condition: ruleMatch[2].trim(), parentId: selectedNode.id });
      return;
    }
    action.mutate({ action: "behavior", nodeId: selectedNode.id, text: instruction.trim() });
  };

  const createConcept = () => {
    if (!selectedNode || !draftNodeName.trim() || action.isPending) return;
    action.mutate({ action: "create", name: draftNodeName.trim(), parentId: selectedNode.id });
  };

  const connectConcept = () => {
    if (!selectedNode || !relationTarget || action.isPending) return;
    action.mutate({ action: "relate", from: selectedNode.id, to: relationTarget, type: relationType });
    setRelationTarget("");
  };

  return <StudioShell>
    <TopBar>
      <div className="integrated-brand"><span className="integrated-brand-mark">H</span><div><strong>HAEL <span>STUDIO</span></strong><small>Program workspace</small></div></div>
      <div className="integrated-project-select"><GitBranch size={14} /><select aria-label="Active project" value={projectId} onChange={(event) => {
        const nextId = event.target.value;
        setProjectId(nextId);
        try { window.localStorage.setItem("hael.activeProjectId", nextId); } catch { /* The selection remains active for this session. */ }
      }} disabled={!projects.length}><option value="" disabled>Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><ChevronDown size={14} /></div>
      <div className={`integrated-engine-status ${field ? "ready" : ""}`}><span />{field ? `Orren · r${fieldQuery.data?.revision ?? 0}` : fieldQuery.isError ? "Orren offline" : "Connecting Orren"}</div>
      <Button variant="outline" size="sm" onClick={() => setLocation(`/projects/${encodeURIComponent(projectId || "default")}/builds`)}><Code2 size={14} /> Build & preview</Button>
    </TopBar>

    <main className="integrated-workbench ide-workbench">
      <nav className="studio-workspace-nav" aria-label="Project workspace">
        <div className="workspace-nav-context"><span className="workspace-nav-icon"><Folder size={15} /></span><div><small>PROJECT WORKSPACE</small><strong>{activeProject?.name ?? (projectsQuery.isLoading ? "Loading projects…" : "Select a project")}</strong></div></div>
        <div className="workspace-nav-links"><button className="active" aria-current="page"><Sparkles size={13} /> Workbench</button><button onClick={() => setLocation(`/projects/${encodeURIComponent(projectId || "default")}/semantic`)}><Workflow size={13} /> Orren model</button><button onClick={() => setLocation(`/projects/${encodeURIComponent(projectId || "default")}/builds`)}><Code2 size={13} /> Source & builds</button><button onClick={() => setLocation(`/projects/${encodeURIComponent(projectId || "default")}/audit`)}><GitBranch size={13} /> Activity</button><button onClick={() => setLocation(`/projects/${encodeURIComponent(projectId || "default")}/members`)}><Users size={13} /> People</button></div>
        <div className="workspace-nav-role">{activeProject?.role ?? "Project"}</div>
      </nav>
      {fieldQuery.isError && <div className="integrated-connection-notice"><span className="integrated-offline-dot" /><div><strong>Orren is not connected</strong><small>{fieldQuery.error instanceof Error ? fieldQuery.error.message : "Start the Orren service to open this program."} Your language draft stays local until the semantic model is available.</small></div><button onClick={() => void fieldQuery.refetch()}><RefreshCw size={13} /> Connect Orren</button></div>}
      {action.isError && <div className="integrated-action-notice" role="alert">{action.error instanceof Error ? action.error.message : "The change was not applied. The program is unchanged."}</div>}

      <section className="ide-layout" aria-label="Studio IDE">
        <aside className="ide-explorer" aria-label="Project explorer">
          <div className="ide-explorer-head"><span>EXPLORER</span><button onClick={() => setLocation(`/projects/${encodeURIComponent(projectId || "default")}/semantic`)} title="Open full Orren model"><Workflow size={14} /></button></div>
          <div className="ide-project-root"><ChevronDown size={13} /><strong>{activeProject?.name ?? "Project"}</strong><span>{activeProject?.role ?? ""}</span></div>
          <div className="ide-tree-group"><div className="ide-tree-label"><ChevronDown size={12} /> PROGRAM</div>
            {fieldQuery.isLoading && <small className="ide-tree-state">Connecting Orren…</small>}
            {nodes.map((node) => <button key={node.id} className={`ide-tree-item ${selectedNode?.id === node.id ? "active" : ""}`} style={{ "--tree-depth": Math.min(node.path.split(".").length - 1, 4) } as CSSProperties} onClick={() => setSelectedNodeId(node.id)} title={node.path}><SquareFunction size={13} /><span>{node.name}</span><small>{node.kind}</small></button>)}
            {!fieldQuery.isLoading && !nodes.length && <small className="ide-tree-state">Program elements will appear here.</small>}
          </div>
          <div className="ide-tree-group"><div className="ide-tree-label"><ChevronDown size={12} /> PROJECT FILES</div>
            {terminalQuery.isLoading && <small className="ide-tree-state">Loading files…</small>}
            {terminalQuery.data?.entries.map((entry) => entry.kind === "folder" ? <button key={entry.name} className="ide-tree-item" onClick={() => changeDirectory(entry.name)} title={`Open ${entry.name}`}><Folder size={13} /><span>{entry.name}</span></button> : <div key={entry.name} className="ide-tree-item file"><Code2 size={13} /><span>{entry.name}</span></div>)}
            {terminalQuery.data?.entries.length === 0 && <small className="ide-tree-state">No files yet. Add a ZIP or clone a repository in the terminal.</small>}
          </div>
          <button className="ide-help-link" onClick={() => setHelpOpen(true)}><CircleHelp size={14} /><span>Command & language guide</span><ArrowRight size={12} /></button>
        </aside>
        <div className="ide-main">
          <div className="ide-tabbar"><div className="ide-file-tab"><SquareFunction size={13} /><span>{selectedNode?.name ?? "Program"}</span><small>HAEL</small></div><button className="ide-tab-action" onClick={() => setLocation(`/projects/${encodeURIComponent(projectId || "default")}/builds`)}><Code2 size={13} /> Source & preview</button><button className="ide-tab-action ide-quick-help" onClick={() => setHelpOpen(true)}><CircleHelp size={13} /> Command guide</button><span className="ide-tab-status"><i /> Orren {field ? `r${fieldQuery.data?.revision ?? 0}` : "connecting"}</span></div>
      <section className="integrated-workbench-grid" aria-label="Language editor and Orren model">
        <section className="language-pane" aria-labelledby="language-pane-title">
          <div className="pane-heading"><div className="pane-heading-mark language-mark"><AudioLines size={16} /></div><div><span>AUTHORING</span><h2 id="language-pane-title">Language editor</h2></div><span className="pane-live-tag">Your words</span></div>
          <div className="language-context"><span className="context-orb"><Sparkles size={15} /></span><div><strong>{selectedNode ? `Working on ${selectedNode.name}` : "Start with an intention"}</strong><p>Describe a behavior, condition, or change in plain language. It will stay attached to this part of the program.</p></div></div>
          <label className="instruction-label" htmlFor="program-instruction">What should this part do?</label>
          <textarea id="program-instruction" className="instruction-input" value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={180} placeholder={'For example: “create variable visit count as number” or “create rule greet visitor when visitor arrives”.'} />
          <div className="instruction-tools"><span>{instruction.length}/180 · language, rules, and intent</span><button className={listening && voiceTarget === "instruction" ? "listening" : ""} onClick={() => startVoiceInput("instruction")} aria-label={listening && voiceTarget === "instruction" ? "Stop voice input" : "Speak your instruction"} title={listening && voiceTarget === "instruction" ? "Stop listening" : "Speak your instruction"}><Mic size={15} />{listening && voiceTarget === "instruction" ? "Listening" : "Speak"}</button></div>
          {voiceError && <p className="voice-note" role="status">{voiceError}</p>}
          <div className="instruction-apply-card"><div><span className="apply-card-icon"><ArrowDownRight size={15} /></span><div><strong>{selectedNode ? `Behavior · ${selectedNode.name}` : field ? "Select a program element" : "Language draft"}</strong><small>{field ? "Orren updates the semantic model. Source code is created only during realization." : "This draft stays here while Studio reconnects to Orren."}</small></div></div><Button onClick={applyInstruction} disabled={!field || !selectedNode || !instruction.trim() || action.isPending}>{action.isPending ? <><LoaderCircle size={14} className="integrated-spin" /> Applying</> : <><ArrowRight size={14} /> Apply to program</>}</Button></div>
          <div className="language-divider"><span>or start with a new concept</span></div>
          <form className="concept-create-form" onSubmit={(event) => { event.preventDefault(); createConcept(); }}><label htmlFor="new-concept">Add a named program element</label><div><input id="new-concept" value={draftNodeName} onChange={(event) => setDraftNodeName(event.target.value)} maxLength={48} placeholder="e.g. visitor language" disabled={!field || !selectedNode} /><button type="submit" aria-label="Add program element" disabled={!field || !selectedNode || !draftNodeName.trim() || action.isPending}><Plus size={15} /></button></div></form>
          <div className="language-footer"><CircleHelp size={13} /><span>Talk about programs, values, rules, and how they connect. You do not need to write code.</span></div>
        </section>

        <section className="program-pane" aria-labelledby="program-pane-title">
          <div className="pane-heading"><div className="pane-heading-mark program-mark"><SquareFunction size={16} /></div><div><span>ORREN SEMANTIC MODEL</span><h2 id="program-pane-title">Program model</h2></div><span className="revision-chip">{field ? `r${fieldQuery.data?.revision ?? 0}` : "Awaiting model"}</span></div>
          {fieldQuery.isLoading && <div className="program-loading"><LoaderCircle size={18} className="integrated-spin" /> Opening the semantic program…</div>}
          {field && <>
            <div className="program-summary"><div><span className="summary-eyebrow">Orren structure</span><strong>{nodes.find((node) => node.id === field.rootId)?.name ?? "Program"}</strong><small>{nodes.length} elements <i /> {field.relations.length} relationships <i /> {field.targets.length} targets</small></div><span className="summary-symbol"><Workflow size={21} /></span></div>
            <div className="program-model-body">
              <div className="model-section-heading"><span>Program elements</span><small>Select one to shape its behavior</small></div>
              <div className="program-element-list">{nodes.map((node, index) => <button className={`program-element ${selectedNode?.id === node.id ? "selected" : ""}`} key={node.id} onClick={() => setSelectedNodeId(node.id)}>
                <span className={`element-index element-index-${index % 4}`}>{node.parentId ? <GitBranch size={14} /> : <SquareFunction size={14} />}</span><span className="element-copy"><strong>{node.name}</strong><small>{node.kind} <i /> {node.path}</small></span>{node.behavior && <span className="element-has-behavior"><Check size={12} /></span>}<ArrowRight size={13} className="element-arrow" />
              </button>)}</div>
              <div className="model-inspector"><div className="inspector-heading"><div><span className="summary-eyebrow">Selected element</span><strong>{selectedNode?.name ?? "Choose an element"}</strong></div><span className="inspector-kind">{selectedNode?.kind ?? "Program"}</span></div>
                {selectedNode?.behavior && <div className="inspector-property"><span>Purpose & behavior</span><p>{selectedNode.behavior}</p></div>}
                {selectedNode?.kind === "Variable" && <div className="inspector-property"><span>Variable type</span><p>{selectedVariableType ?? "Type not specified"}</p></div>}
                {selectedNode?.kind === "Rule" && <div className="inspector-property"><span>Activation condition</span><p>{selectedRuleCondition ?? "Condition not specified"}</p></div>}
                {!selectedNode?.behavior && !selectedVariableType && !selectedRuleCondition && <div className="inspector-property"><span>Purpose & behavior</span><p>No behavior described yet. Add it in Language and apply it to this element.</p></div>}
                <div className="inspector-property inspector-relationships"><span>Connected logic</span>{selectedRelations.length ? selectedRelations.map((relation) => {
                  const peerId = relation.from === selectedNode?.id ? relation.to : relation.from;
                  const peer = nodes.find((node) => node.id === peerId);
                  return <div className="relation-chip" key={relation.id}><span>{relation.from === selectedNode?.id ? "→" : "←"}</span><strong>{relation.label || relation.type}</strong><i />{peer?.name ?? peerId}</div>;
                }) : <small>No relationships yet. Connections remain explicit in Orren’s model.</small>}
                  {nodes.length > 1 && <form className="relation-create-form" onSubmit={(event) => { event.preventDefault(); connectConcept(); }}><select aria-label="Relationship type" value={relationType} onChange={(event) => setRelationType(event.target.value)}><option value="triggers">triggers</option><option value="feeds">feeds</option><option value="produces">produces</option><option value="depends_on">depends on</option></select><select aria-label="Related program element" value={relationTarget} onChange={(event) => setRelationTarget(event.target.value)}><option value="">Choose a related element</option>{nodes.filter((node) => node.id !== selectedNode?.id).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select><button type="submit" disabled={!relationTarget || action.isPending}><Plus size={12} /> Connect</button></form>}
                </div>
                <div className="program-model-foot"><span><GitBranch size={12} /> {selectedNode?.path ?? field.runtime.sourceFile}</span><span>{field.runtime.sessionOnly ? "Session model" : "Persistent model"}</span></div>
              </div>
            </div>
            <div className="realization-strip"><span className="realization-mark"><Code2 size={14} /></span><div><strong>{field.runtime.codegenAvailable ? "Ready to realize" : "Meaning first. Code when ready."}</strong><small>{field.runtime.codegenMessage || "The semantic model is the source of truth. Orren emits source artifacts during realization."}</small></div><span className={field.runtime.codegenAvailable ? "realization-ready" : "realization-plan"}>{field.runtime.codegenAvailable ? "Available" : "Plan only"}</span></div>
          </>}
          {!field && !fieldQuery.isLoading && <div className="program-empty"><div><Workflow size={22} /></div><strong>Your program model will appear here</strong><span>Connect Orren to see its live structure and shape it in language.</span></div>}
        </section>
      </section>

      <section className="terminal-panel" aria-labelledby="terminal-title">
        <div className="terminal-header">
          <div className="terminal-heading-icon"><Terminal size={14} /></div>
          <div className="terminal-title-group"><h2 id="terminal-title">Terminal</h2></div>
          <div className="terminal-tabs"><span className="active">TERMINAL</span></div>
          <div className="terminal-path" title={terminalQuery.data?.cwd ?? "Opening project workspace"}><span>{terminalQuery.data?.cwd ?? "Opening project workspace"}</span></div>
          <button className="terminal-help-button" onClick={() => setHelpOpen(true)}><HelpCircle size={14} /><span>Help</span></button>
        </div>
        <div className="terminal-layout">
          <div className="terminal-screen" aria-live="polite">
            {terminalQuery.isLoading && <div className="terminal-system-line"><LoaderCircle size={12} className="integrated-spin" /> Opening project shell…</div>}
            {terminalQuery.isError && <div className="terminal-system-line terminal-error">{terminalQuery.error instanceof Error ? terminalQuery.error.message : "The project folder could not be opened."}</div>}
            {terminalQuery.data && !terminalLines.length && <div className="terminal-session-banner"><span>HAEL project shell · connected to Orren {field?.runtime.engineVersion ?? ""}</span><span>Workspace {terminalQuery.data.cwd}</span><span>Type <code>help</code> to see project and language commands.</span></div>}
            {terminalLines.map((line) => <div className="terminal-output-group" key={line.id}>
              {line.input && <div className="terminal-command-line"><span className="terminal-prompt-user">hael</span><span className="terminal-prompt-cwd">{line.cwd.replace(`/projects/${projectId}`, "~") || "~"}</span><span className="terminal-prompt-dollar">$</span><code>{line.input}</code></div>}
              <pre className={`terminal-response ${line.kind === "error" ? "terminal-error" : ""}`}>{line.message}</pre>
              {line.kind === "confirm" && pendingCommand?.input === line.input && <div className="terminal-confirm-actions"><button onClick={() => { setPendingCommand(null); setTerminalLines((lines) => lines.filter((item) => item.id !== line.id)); }}>Cancel</button><button onClick={() => submitTerminalCommand(pendingCommand.input, true)} disabled={terminalCommand.isPending}>{terminalCommand.isPending ? "Working…" : "Confirm and continue"}</button></div>}
            </div>)}
            <div ref={terminalEndRef} />
          </div>
        </div>
        <div className="terminal-input-row">
          <span className="terminal-input-path">{terminalQuery.data?.cwd ?? "/projects"}<b>$</b></span>
          <input aria-label="Command line input" value={terminalInput} onChange={(event) => { setTerminalInput(event.target.value); setHistoryCursor(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitTerminalCommand(); } else if (event.key === "ArrowUp" && commandHistory.length) { event.preventDefault(); const index = historyCursor === null ? commandHistory.length - 1 : Math.max(0, historyCursor - 1); setHistoryCursor(index); setTerminalInput(commandHistory[index] ?? ""); } else if (event.key === "ArrowDown" && historyCursor !== null) { event.preventDefault(); const index = Math.min(commandHistory.length, historyCursor + 1); setHistoryCursor(index === commandHistory.length ? null : index); setTerminalInput(commandHistory[index] ?? ""); } }} placeholder="Type a command or describe a change…" disabled={!terminalQuery.data || terminalCommand.isPending || terminalOrrenAction.isPending} />
          <button type="button" className={listening && voiceTarget === "terminal" ? "listening" : ""} onClick={() => startVoiceInput("terminal")} aria-label={listening && voiceTarget === "terminal" ? "Stop listening" : "Speak command"} title="Speak a command"><Mic size={15} /></button>
          <button type="button" className="terminal-submit" disabled={!terminalInput.trim() || terminalCommand.isPending || terminalOrrenAction.isPending} onClick={() => submitTerminalCommand()}><CornerDownLeft size={14} /><span>{terminalCommand.isPending || terminalOrrenAction.isPending ? "Working" : "Run"}</span></button>
          <input ref={archivePickerRef} className="terminal-file-picker" type="file" accept=".zip,application/zip" aria-label="Choose a ZIP archive" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadArchive.mutate(file); event.target.value = ""; }} />
          <button type="button" className="terminal-upload-button" onClick={() => archivePickerRef.current?.click()} disabled={uploadArchive.isPending}><Upload size={14} /><span>{uploadArchive.isPending ? "Adding…" : "Add ZIP"}</span></button>
        </div>
        {uploadArchive.isError && <div className="terminal-command-error" role="alert">{uploadArchive.error instanceof Error ? uploadArchive.error.message : "The archive could not be added."}</div>}
        <div className="terminal-hint"><Command size={12} /><span>Current directory: <code>{terminalQuery.data?.cwd ?? "/projects"}</code> · <code>↑</code>/<code>↓</code> history · type <code>help</code> for commands</span><span>Enter to run</span></div>
      </section>
        </div>
      </section>

      {helpOpen && <div className="terminal-help-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}><section className="terminal-help-dialog" role="dialog" aria-modal="true" aria-labelledby="terminal-help-title">
        <div className="terminal-help-title"><div><span>ORREN COMMAND LANGUAGE</span><h2 id="terminal-help-title">Say what you want to do.</h2></div><button onClick={() => setHelpOpen(false)} aria-label="Close help"><X size={17} /></button></div>
        <p>This command line understands a small set of project actions. Type a command or use the microphone; spoken words appear here for you to review before running.</p>
        <div className="terminal-help-examples"><div><code>pwd</code><span>Show the current project folder</span></div><div><code>go to src</code><span>Move into a folder; “cd src” works too</span></div><div><code>list files</code><span>See what is in the current folder</span></div><div><code>unzip starter.zip</code><span>Extract an archive into this project</span></div><div><code>clone owner/repository</code><span>Clone a public GitHub repository here</span></div><div><code>create element visitor profile</code><span>Add a named element to Orren</span></div><div><code>create variable visit count as number</code><span>Add a typed value to the program</span></div><div><code>create rule greet visitor when visitor arrives</code><span>Add an activation condition to Orren</span></div><div><code>describe behavior: greet visitors</code><span>Attach intent to the selected element</span></div><div><code>connect entry to profile as feeds</code><span>Connect two named elements in Orren</span></div></div>
        <div className="terminal-help-policy"><strong>What happens when you run a command</strong><span>Orren commands update the shared semantic program model, including typed variables and declarative activation rules. Navigation and listing stay inside this project. Extracting files and cloning a repository show a preview and ask you to confirm; existing files are not overwritten. This is not a general-purpose shell, so unrecognized commands are not run. Rule conditions are semantic intent; executable output is a later Orren realization step.</span></div>
        <div className="terminal-help-policy"><strong>Voice & privacy</strong><span>The microphone starts only when you press it. Your browser may use its speech-recognition service to turn speech into text; review the transcript before submitting it.</span></div>
        <Button onClick={() => setHelpOpen(false)}>Got it</Button>
      </section></div>}

      <footer className="integrated-workbench-footer"><span><span className="footer-status-dot" /> One shared program model</span><span>Language ↔ Orren structure <i /> Studio runtime & preview</span><span>{field ? `${field.runtime.engineVersion} · ${field.runtime.mode}` : "Local changes wait for Orren"}</span></footer>
    </main>
  </StudioShell>;
}
