import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock3, History, ShieldCheck } from "lucide-react";
import { Link, useRoute } from "wouter";
import { StudioShell } from "@/shell/StudioShell";
import { TopBar } from "@/shell/TopBar";
import "@/project-audit.css";

type AuditEvent = {
  id: string;
  projectId: string;
  actorSubject: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId: string;
  outcome: "succeeded" | "rejected";
  metadata: Record<string, unknown>;
  createdAt: string;
};

export default function ProjectAudit() {
  const [, params] = useRoute("/projects/:projectId/audit");
  const projectId = params?.projectId ?? "";
  const history = useQuery({
    queryKey: ["project-audit", projectId],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<AuditEvent[]> => {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/audit?limit=100`);
      const payload = await response.json() as AuditEvent[] | { error?: string };
      if (!response.ok) throw new Error("error" in payload ? payload.error : "Could not load project history.");
      return payload as AuditEvent[];
    },
  });

  return <StudioShell>
    <TopBar>
      <Link className="project-audit-back" href="/"><ArrowLeft size={15} /> Studio</Link>
      <div className="project-audit-brand"><History size={17} /><span><strong>Project history</strong><small>Accountable changes</small></span></div>
      <span className="project-audit-scope"><ShieldCheck size={14} /> Owner and admin access</span>
    </TopBar>
    <main className="project-audit-page">
      <header><span className="eyebrow">Studio · audit history</span><h1>Changes with context.</h1><p>Recent project actions, their actor, and the request that recorded them.</p></header>
      {history.isLoading && <section className="project-audit-state">Loading project history…</section>}
      {history.isError && <section className="project-audit-state error"><strong>History could not be opened</strong><span>{history.error instanceof Error ? history.error.message : "Try again or ask a project owner for access."}</span></section>}
      {history.data && <section className="project-audit-list" aria-label="Recent project changes">
        {history.data.map((event) => <article className="project-audit-event" key={event.id}>
          <span className="project-audit-icon"><Clock3 size={15} /></span>
          <div className="project-audit-copy"><div className="project-audit-title"><strong>{event.action.replaceAll(".", " · ")}</strong><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></div>
            <p><span>{event.actorSubject}</span>{event.resourceId && <> changed <code>{event.resourceType} · {event.resourceId}</code></>}</p>
            <small>Request {event.requestId}{Object.keys(event.metadata).length > 0 && <> · {Object.entries(event.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</>}</small>
          </div>
          <span className="project-audit-outcome">{event.outcome}</span>
        </article>)}
        {!history.data.length && <div className="project-audit-empty"><History size={20} /><strong>No recorded changes yet</strong><span>New project activity will appear here.</span></div>}
      </section>}
    </main>
  </StudioShell>;
}
