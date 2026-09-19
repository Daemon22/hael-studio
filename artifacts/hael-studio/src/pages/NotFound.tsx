import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Compass } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="not-found-shell">
      <Card className="not-found-card">
        <CardContent>
          <div className="not-found-mark"><Compass size={24} /></div>
          <span className="eyebrow">Hael Studio / quiet orbit</span>
          <h1>404</h1>
          <h2>This surface is not in the constellation.</h2>
          <p>The workspace could not resolve that path. Return to the active intention and continue where you left off.</p>
          <Button data-testid="button-return-home" onClick={handleGoHome}><ArrowLeft size={15} /> Return to studio</Button>
        </CardContent>
      </Card>
    </div>
  );
}
