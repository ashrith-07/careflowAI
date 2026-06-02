import { AgentCard } from "@/components/AgentCard";
import { AgentOrbit } from "@/components/AgentOrbit";
import { ApprovalModal } from "@/components/ApprovalModal";
import { AuditLog } from "@/components/AuditLog";
import { EmailInput } from "@/components/EmailInput";
import { ResultPanel } from "@/components/ResultPanel";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">CareFlow AI</h1>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <AgentOrbit />
        <div className="grid gap-6 md:grid-cols-2">
          <AgentCard />
          <EmailInput />
          <ResultPanel />
          <ApprovalModal />
        </div>
        <AuditLog />
      </main>
    </div>
  );
}
