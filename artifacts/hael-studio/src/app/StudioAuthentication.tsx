import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import "./studio-authentication.css";

type Session = { subject: string };
type SessionError = Error & { status?: number };

export function StudioAuthentication({ children }: { children: ReactNode }) {
  const session = useQuery({
    queryKey: ["studio-session"],
    retry: false,
    queryFn: async (): Promise<Session> => {
      const response = await fetch("/api/auth/session", { credentials: "same-origin" });
      if (!response.ok) {
        const error = new Error(response.status === 401 ? "Sign in to open your Studio projects." : "Studio could not confirm your session.") as SessionError;
        error.status = response.status;
        throw error;
      }
      return response.json() as Promise<Session>;
    },
  });

  if (session.isLoading) return <main className="studio-auth-stage"><div className="studio-auth-card"><LoaderCircle className="studio-auth-spin" size={24} /><span>Opening your Studio…</span></div></main>;
  if (session.data) return children;

  const status = (session.error as SessionError | null)?.status;
  const needsSignIn = status === 401;
  return <main className="studio-auth-stage"><section className="studio-auth-card">
    <div className="studio-auth-mark">H</div>
    <span className="studio-auth-eyebrow">HAEL STUDIO</span>
    <h1>{needsSignIn ? "Your work, held safely." : "Studio is not connected yet."}</h1>
    <p>{needsSignIn ? "Sign in to open your projects, semantic workspaces, and review history." : session.error instanceof Error ? session.error.message : "The Studio API could not be reached."}</p>
    {needsSignIn ? <a className="studio-auth-primary" href="/api/auth/login"><LockKeyhole size={16} /> Continue to sign in</a> : <button className="studio-auth-primary" onClick={() => void session.refetch()}><RefreshCw size={16} /> Retry connection</button>}
    <div className="studio-auth-trust"><ShieldCheck size={14} /><span>Project access is checked by Studio for every request.</span></div>
  </section></main>;
}
