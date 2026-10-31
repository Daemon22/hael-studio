import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, GitBranch, Hammer, LoaderCircle, Play, RefreshCw, ShieldCheck, StopCircle } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudioShell } from "@/shell/StudioShell";
import { TopBar } from "@/shell/TopBar";
import "@/project-builds.css";

type BuildStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
type BuildManifestEntry = { path: string; sha256: string; semanticNodeIds: string[]; runtimeIds: string[] };
type BuildJob = {
  id: string; projectId: string; requestedBy: string; sourceRepository?: string; sourceBranch?: string; sourceCommit: string; semanticRevision: number;
  artifactManifestHash: string; status: BuildStatus; previewUrl?: string; outputManifest: BuildManifestEntry[];
  diagnostics?: string; createdAt: string; startedAt?: string; finishedAt?: string;
  retryable?: boolean;
  cancelable?: boolean;
};
type RuntimeObservation = {
  id: string; projectId: string; buildId: string; actorSubject: string; streamId: string; sequence: number; runtimeId: string;
  eventType: string; artifactPath: string; artifactHash: string; semanticNodeIds: string[]; detail?: string; observedAt: string;
};
type OrrenBuildSnapshot = { connected: true; projectId?: string; revision?: number; field?: { runtime?: { codegenAvailable?: boolean; codegenMessage?: string; fingerprint?: string } } };
type ProjectRepository = { connected: boolean; repository?: string; branch?: string; headCommit?: string; commitUrl?: string };
type ApiError = { error?: string; build?: BuildJob };

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json() as T | ApiError;
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload
      && typeof (payload as ApiError).error === "string" ? (payload as ApiError).error! : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

export default function ProjectBuilds() {
  const [, params] = useRoute("/projects/:projectId/builds");
  const projectId = params?.projectId ?? "";
  const client = useQueryClient();
  const [sourceCommit, setSourceCommit] = useState("");
  const [repositoryName, setRepositoryName] = useState("");
  const [repositoryBranch, setRepositoryBranch] = useState("main");
  const [manifestHash, setManifestHash] = useState("");
  const [expandedBuildId, setExpandedBuildId] = useState("");
  const projectQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => readJson<Array<{ id: string; name: string; role: "owner" | "admin" | "editor" | "viewer" }>>(await fetch("/api/projects")),
  });
  const orrenQuery = useQuery({
    queryKey: ["orren", "build-inputs", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => readJson<OrrenBuildSnapshot>(await fetch("/api/orren/field", { headers: { "x-studio-project-id": projectId } })),
    refetchInterval: 15000,
  });
  const repositoryQuery = useQuery({
    queryKey: ["project-repository", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => readJson<ProjectRepository>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/repository`)),
  });
  const buildsQuery = useQuery({
    queryKey: ["project-builds", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => readJson<BuildJob[]>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/builds`)),
    refetchInterval: (query) => query.state.data?.some((job) => job.status === "queued" || job.status === "running") ? 4000 : false,
  });
  const observationsQuery = useQuery({
    queryKey: ["build-observations", projectId, expandedBuildId],
    enabled: Boolean(expandedBuildId),
    queryFn: async () => readJson<RuntimeObservation[]>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/builds/${encodeURIComponent(expandedBuildId)}/observations`)),
  });
  const createBuild = useMutation({
    mutationFn: async () => readJson<BuildJob>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/builds`, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ sourceCommit, semanticRevision: Number(pinnedSemanticRevision), artifactManifestHash: manifestHash }),
    })),
    onSuccess: async () => {
      setSourceCommit(""); setManifestHash("");
      await client.invalidateQueries({ queryKey: ["project-builds", projectId] });
    },
    onError: async () => { await client.invalidateQueries({ queryKey: ["project-builds", projectId] }); },
  });
  const action = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "retry" | "cancel" }) => readJson<BuildJob>(await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/builds/${encodeURIComponent(id)}/${kind}`,
      { method: "POST" },
    )),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["project-builds", projectId] }); },
    onError: async () => { await client.invalidateQueries({ queryKey: ["project-builds", projectId] }); },
  });
  const connectRepository = useMutation({
    mutationFn: async () => readJson<ProjectRepository>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/repository`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ repository: repositoryName, branch: repositoryBranch }),
    })),
    onSuccess: async (repository) => {
      client.setQueryData(["project-repository", projectId], repository);
      if (repository.headCommit) setSourceCommit(repository.headCommit);
    },
    onError: async () => { await client.invalidateQueries({ queryKey: ["project-repository", projectId] }); },
  });

  const project = projectQuery.data?.find((item) => item.id === projectId);
  const builds = buildsQuery.data ?? [];
  const canBuild = project?.role !== "viewer" && Boolean(project);
  const liveSemanticRevision = typeof orrenQuery.data?.revision === "number" ? String(orrenQuery.data.revision) : "";
  const pinnedSemanticRevision = liveSemanticRevision;
  const sourceArtifactsReady = orrenQuery.data?.field?.runtime?.codegenAvailable === true;
  const repository = repositoryQuery.data;
  const canManageRepository = project?.role === "owner" || project?.role === "admin";
  useEffect(() => {
    if (repository?.repository) setRepositoryName(repository.repository);
    if (repository?.branch) setRepositoryBranch(repository.branch);
    if (repository?.headCommit && !sourceCommit) setSourceCommit(repository.headCommit);
  }, [repository?.repository, repository?.branch, repository?.headCommit, sourceCommit]);
  const validInputs = useMemo(() => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(sourceCommit.trim())
    && /^\d+$/.test(pinnedSemanticRevision) && Number(pinnedSemanticRevision) <= 2_147_483_647
    && /^[a-f0-9]{64}$/i.test(manifestHash.trim()), [sourceCommit, pinnedSemanticRevision, manifestHash]);

  return <StudioShell>
    <TopBar>
      <Link href="/" className="project-builds-back"><ArrowLeft size={15} /> Studio</Link>
      <div className="project-builds-brand"><Hammer size={16} /><span><strong>Build & preview</strong><small>{project?.name ?? "Project"}</small></span></div>
      <span className="project-builds-trust"><ShieldCheck size={14} /> Runner boundary</span>
    </TopBar>
    <main className="project-builds-page">
      <header><span className="eyebrow">Studio · realization</span><h1>Build from pinned meaning.</h1><p>Each preview records the source commit, semantic revision, and immutable Orren manifest used to create it.</p><Link className="project-builds-semantic-link" href={`/projects/${encodeURIComponent(projectId)}/semantic`}>Open Orren semantic workspace</Link></header>
      <section className="project-build-form project-repository-card">
        <div className="project-build-form-heading"><div><strong><GitBranch size={15} /> Source repository</strong><span>Connect the project to a GitHub repository and branch. Studio verifies every pinned commit against this binding.</span></div><span className="project-build-step">Project source</span></div>
        {repositoryQuery.isLoading && <div className="project-build-state"><LoaderCircle size={15} className="project-build-spin" /> Checking repository connection…</div>}
        {repositoryQuery.isError && <div className="project-build-state error">{repositoryQuery.error instanceof Error ? repositoryQuery.error.message : "Repository connection could not be loaded."}</div>}
        {repository?.connected && <div className="project-repository-connected"><strong>{repository.repository}</strong><span><GitBranch size={13} /> {repository.branch}</span>{repository.headCommit && <a href={repository.commitUrl} target="_blank" rel="noreferrer"><code>{repository.headCommit}</code><ExternalLink size={12} /></a>}</div>}
        {canManageRepository && <form className="project-repository-form" onSubmit={(event) => { event.preventDefault(); connectRepository.mutate(); }}><label>GitHub owner/repository<Input value={repositoryName} onChange={(event) => setRepositoryName(event.target.value)} placeholder="owner/repository" maxLength={201} autoComplete="off" /></label><label>Branch<Input value={repositoryBranch} onChange={(event) => setRepositoryBranch(event.target.value)} placeholder="main" maxLength={128} autoComplete="off" /></label><Button type="submit" variant="outline" disabled={!repositoryName.trim() || !repositoryBranch.trim() || connectRepository.isPending}><GitBranch size={14} />{connectRepository.isPending ? "Connecting…" : repository?.connected ? "Update source" : "Connect source"}</Button></form>}
        {connectRepository.isError && <div className="project-build-state error">{connectRepository.error instanceof Error ? connectRepository.error.message : "GitHub repository could not be connected."}</div>}
        {!repository?.connected && !canManageRepository && !repositoryQuery.isLoading && <div className="project-build-state">A project owner or admin must connect a GitHub repository before builds can be requested.</div>}
      </section>
      {canBuild && <form className="project-build-form" onSubmit={(event) => { event.preventDefault(); createBuild.mutate(); }}>
        <div className="project-build-form-heading"><div><strong>Request a preview build</strong><span>Studio sends this pinned request to the private build runner.</span></div><span className="project-build-step">1 · pin inputs</span></div>
        <label>Verified source commit<Input value={sourceCommit} onChange={(event) => setSourceCommit(event.target.value.trim())} placeholder={repository?.headCommit ?? "Connect a repository first"} maxLength={64} autoComplete="off" disabled={!repository?.connected} /><small className="project-build-field-help">The initial value is the branch head. Older commits are accepted only when GitHub confirms they belong to this repository.</small></label>
        <div className="project-build-two-fields"><label>Orren semantic revision<Input value={liveSemanticRevision ? `r${liveSemanticRevision}` : orrenQuery.isLoading ? "Connecting to Orren…" : "Unavailable"} readOnly aria-label="Current Orren semantic revision" /></label><label>Artifact manifest SHA-256<Input value={manifestHash} onChange={(event) => setManifestHash(event.target.value.trim())} placeholder="64 character manifest hash" maxLength={64} autoComplete="off" /></label></div>
        {orrenQuery.isError && <p className="project-build-state error">Orren’s project revision could not be read. Connect the project-scoped Orren session before building.</p>}
        {orrenQuery.data?.field?.runtime?.codegenAvailable === false && <p className="project-build-state">Orren currently provides a realization plan, not emitted source artifacts. A source commit and artifact manifest must come from the connected repository and artifact pipeline before a build can be submitted.</p>}
        {(createBuild.isError || createBuild.data?.status === "failed") && <p className="project-build-error">{createBuild.error instanceof Error ? createBuild.error.message : createBuild.data?.diagnostics}</p>}
        <footer><span>{sourceArtifactsReady ? "Preview links use the configured preview origin. Runner isolation depends on deployment policy." : "Builds unlock when Orren emits a source manifest and Studio has a trusted repository connection."}</span><Button type="submit" disabled={!validInputs || !sourceArtifactsReady || createBuild.isPending}><Play size={14} />{createBuild.isPending ? "Submitting…" : "Build preview"}</Button></footer>
      </form>}
      {!canBuild && project && <section className="project-build-state">This project role can inspect existing builds but cannot start a new one.</section>}
      {buildsQuery.isError && <section className="project-build-state error">{buildsQuery.error instanceof Error ? buildsQuery.error.message : "Build history could not be loaded."}</section>}
        {action.isError && <section className="project-build-state error">{action.error instanceof Error ? action.error.message : "The build action could not be completed."}</section>}
      <section className="project-build-history">
        <div className="project-build-history-heading"><div><span className="eyebrow">Project history</span><h2>Builds & previews</h2></div><Button variant="outline" size="sm" onClick={() => void buildsQuery.refetch()} disabled={buildsQuery.isFetching}><RefreshCw size={13} /> Refresh</Button></div>
        {buildsQuery.isLoading && <div className="project-build-state"><LoaderCircle size={16} className="project-build-spin" /> Loading build history…</div>}
        {!buildsQuery.isLoading && !builds.length && <div className="project-build-empty"><Hammer size={20} /><strong>No builds yet</strong><span>A preview appears here after a pinned build request is accepted.</span></div>}
        {builds.map((job) => <article className="project-build-card" key={job.id}>
          <div className="project-build-card-top"><div><span className={`project-build-status status-${job.status}`}>{job.status === "running" || job.status === "queued" ? <LoaderCircle size={12} className="project-build-spin" /> : <span className="project-build-status-dot" />}{job.status}</span><time>{new Date(job.createdAt).toLocaleString()}</time></div><code>{job.id.slice(0, 8)}</code></div>
          <div className="project-build-pins"><span><small>Repository · {job.sourceBranch ?? "unbound"}</small><code>{job.sourceRepository ?? "No repository binding"}</code></span><span><small>Source commit</small><code>{job.sourceCommit.slice(0, 12)}</code></span><span><small>Orren revision</small><code>{job.semanticRevision}</code></span><span><small>Manifest</small><code>{job.artifactManifestHash.slice(0, 12)}</code></span></div>
          {job.diagnostics && <p className="project-build-diagnostics">{job.diagnostics}</p>}
          {job.previewUrl && job.status === "succeeded" && <a className="project-build-preview" href={job.previewUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open isolated preview</a>}
          <div className="project-build-actions"><button onClick={() => { setExpandedBuildId((current) => current === job.id ? "" : job.id); }} aria-expanded={expandedBuildId === job.id}>Provenance ({job.outputManifest.length} artifacts)</button>{job.retryable && canBuild && <button onClick={() => action.mutate({ id: job.id, kind: "retry" })} disabled={action.isPending}><RefreshCw size={12} /> {job.status === "queued" ? "Dispatch" : "Retry"}</button>}{job.cancelable && canBuild && <button onClick={() => action.mutate({ id: job.id, kind: "cancel" })} disabled={action.isPending}><StopCircle size={12} /> Cancel</button>}</div>
          {expandedBuildId === job.id && <div className="project-build-manifest">{job.outputManifest.length ? job.outputManifest.map((entry) => <div className="project-build-manifest-entry" key={`${entry.path}:${entry.sha256}`}><code>{entry.path}</code><small>{entry.sha256.slice(0, 16)} · {entry.semanticNodeIds.length} semantic nodes · {entry.runtimeIds.length} runtime IDs</small></div>) : <small>No output manifest has been returned for this build.</small>}{observationsQuery.isLoading && <small>Loading runtime history…</small>}{observationsQuery.data?.map((event) => <div className="project-build-observation" key={event.id}><time>{new Date(event.observedAt).toLocaleTimeString()}</time><strong>{event.eventType}</strong><span>{event.runtimeId} · {event.artifactPath}</span><small>{event.actorSubject}{event.detail ? ` · ${event.detail}` : ""}</small></div>)}</div>}
        </article>)}
      </section>
    </main>
  </StudioShell>;
}
