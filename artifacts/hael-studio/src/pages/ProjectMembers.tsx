import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LoaderCircle, ShieldCheck, UserPlus, UsersRound, UserX } from "lucide-react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StudioShell } from "@/shell/StudioShell";
import { TopBar } from "@/shell/TopBar";
import "@/project-members.css";

type Member = { subject: string; role: "owner" | "admin" | "editor" | "viewer"; grantedBy?: string; createdAt?: string };
type Project = { id: string; name: string; role: Member["role"] };

async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 204) return null as T;
  const payload = await response.json() as T | { error?: string };
  if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string" ? payload.error : "Request failed.");
  return payload as T;
}

export default function ProjectMembers() {
  const [, params] = useRoute("/projects/:projectId/members");
  const projectId = params?.projectId ?? "";
  const client = useQueryClient();
  const [subject, setSubject] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const projects = useQuery({ queryKey: ["projects"], queryFn: async () => readJson<Project[]>(await fetch("/api/projects")) });
  const members = useQuery({ queryKey: ["project-members", projectId], enabled: Boolean(projectId) && (projects.data?.some((item) => item.id === projectId && (item.role === "owner" || item.role === "admin")) ?? false), queryFn: async () => readJson<Member[]>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/memberships`)) });
  const change = useMutation({
    mutationFn: async ({ operation, memberSubject }: { operation: "grant" | "revoke"; memberSubject: string }) => readJson<Member | null>(await fetch(
      operation === "grant" ? `/api/projects/${encodeURIComponent(projectId)}/memberships` : `/api/projects/${encodeURIComponent(projectId)}/memberships/${encodeURIComponent(memberSubject)}`,
      operation === "grant" ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: memberSubject, role }) } : { method: "DELETE" },
    )),
    onSuccess: async () => { setSubject(""); await Promise.all([client.invalidateQueries({ queryKey: ["project-members", projectId] }), client.invalidateQueries({ queryKey: ["projects"] })]); },
    onError: async () => { await client.invalidateQueries({ queryKey: ["project-members", projectId] }); },
  });
  const project = projects.data?.find((item) => item.id === projectId);
  const canAdmin = project?.role === "owner" || project?.role === "admin";
  const canGrantAdmin = project?.role === "owner";
  return <StudioShell>
    <TopBar><Link href="/" className="project-members-back"><ArrowLeft size={15} /> Studio</Link><div className="project-members-brand"><UsersRound size={16} /><span><strong>Project members</strong><small>{project?.name ?? "Project"}</small></span></div><span className="project-members-trust"><ShieldCheck size={14} /> Role managed</span></TopBar>
    <main className="project-members-page">
      <header><span className="eyebrow">Studio · access</span><h1>People in this project.</h1><p>Give each person the least access they need. Owners control admins; admins can manage editors and viewers.</p></header>
      {!canAdmin && <section className="project-members-state">Membership details are available to project owners and admins.</section>}
      {canAdmin && <>
        <form className="project-members-form" onSubmit={(event) => { event.preventDefault(); change.mutate({ operation: "grant", memberSubject: subject.trim() }); }}>
          <label>Account subject<Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Identity provider subject" maxLength={255} autoComplete="off" /></label>
          <label>Project role<select value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="editor">Editor · change project content</option><option value="viewer">Viewer · inspect project</option>{canGrantAdmin && <option value="admin">Admin · manage access and history</option>}</select></label>
          <Button type="submit" disabled={!subject.trim() || change.isPending}><UserPlus size={14} /> Add or update member</Button>
        </form>
        {change.isError && <section className="project-members-state error">{change.error instanceof Error ? change.error.message : "Membership could not be updated."}</section>}
        {members.isError && <section className="project-members-state error">{members.error instanceof Error ? members.error.message : "Membership could not be loaded."}</section>}
        <section className="project-members-list"><div className="project-members-list-heading"><div><span className="eyebrow">Access list</span><h2>Members</h2></div><span>{members.data?.length ?? 0} people</span></div>
          {members.isLoading && <div className="project-members-state"><LoaderCircle size={15} className="project-members-spin" /> Loading membership…</div>}
          {members.data?.map((member) => <article key={member.subject}><div><strong>{member.subject}</strong><span className={`project-members-role role-${member.role}`}>{member.role}</span></div><small>{member.grantedBy ? `Added by ${member.grantedBy}` : "Project owner"}</small>{member.role !== "owner" && canAdmin && (project?.role === "owner" || member.role !== "admin") && <button aria-label={`Remove ${member.subject}`} onClick={() => change.mutate({ operation: "revoke", memberSubject: member.subject })} disabled={change.isPending}><UserX size={14} /> Remove</button>}</article>)}
        </section>
      </>}
    </main>
  </StudioShell>;
}
