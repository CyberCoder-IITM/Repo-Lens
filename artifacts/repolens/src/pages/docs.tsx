import { Link } from "wouter";
import { ArrowLeft, Zap, Database, GitBranch, Code2, GitMerge, FileText, Shield } from "lucide-react";
import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";

export default function Docs() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 md:py-16 max-w-3xl flex-1">
        <Link href="/" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Link>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">
          Documentation
        </h1>
        <p className="text-muted-foreground font-mono mb-12 text-sm md:text-base">
          Everything you need to know about RepoLens.
        </p>

        {/* What is RepoLens */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> What is RepoLens?
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            RepoLens is an AI-powered documentation agent. Paste any public GitHub repository URL and it automatically generates:
          </p>
          <ul className="space-y-3">
            {[
              { icon: <FileText className="w-4 h-4 text-primary" />, title: "README", desc: "A professional, full-length README written as if by a senior engineer who read every file." },
              { icon: <Code2 className="w-4 h-4 text-primary" />, title: "Docstrings", desc: "Inline documentation for all major functions and classes in the correct format for the language (JSDoc, Python, Rustdoc, etc.)." },
              { icon: <GitMerge className="w-4 h-4 text-primary" />, title: "Architecture Diagram", desc: "An interactive Mermaid flowchart showing how all components connect — frontend, backend, database, external services." },
            ].map(item => (
              <li key={item.title} className="flex gap-3 bg-card/40 border border-border rounded-lg p-4">
                <div className="mt-0.5 shrink-0">{item.icon}</div>
                <div>
                  <span className="font-mono font-semibold text-sm">{item.title}</span>
                  <p className="text-muted-foreground text-sm mt-0.5">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* How to use */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-primary" /> How to Use
          </h2>
          <ol className="space-y-4">
            {[
              { step: "1", text: "Go to the home page and paste a public GitHub repository URL into the search bar — e.g. https://github.com/owner/repo" },
              { step: "2", text: 'Click "Analyze". RepoLens clones the repository, traverses its files, and detects the tech stack.' },
              { step: "3", text: "Wait 20–60 seconds depending on repo size. A live progress bar tracks every stage: cloning → analyzing → generating." },
              { step: "4", text: "Once complete, browse the Overview, Docstrings, and Architecture tabs to read the generated documentation." },
            ].map(item => (
              <li key={item.step} className="flex gap-4">
                <span className="shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary font-mono font-bold text-sm flex items-center justify-center border border-primary/30">
                  {item.step}
                </span>
                <p className="text-muted-foreground text-sm leading-relaxed pt-0.5">{item.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* API Reference */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" /> API Reference
          </h2>
          <div className="space-y-3">
            {[
              { method: "POST", path: "/api/repos/analyze", desc: "Submit a GitHub repo URL for analysis. Returns the new repo object with status cloning." },
              { method: "GET",  path: "/api/repos", desc: "List all previously analyzed repositories." },
              { method: "GET",  path: "/api/repos/:id", desc: "Get full repo details including all generated content." },
              { method: "GET",  path: "/api/repos/:id/status", desc: "Poll analysis status. Returns status, progress (0–100), and currentStep." },
              { method: "GET",  path: "/api/repos/stats/summary", desc: "Aggregate counts: total, completed, pending, failed." },
            ].map(item => (
              <div key={item.path} className="bg-card/40 border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                <Badge
                  variant="outline"
                  className={`font-mono text-xs shrink-0 w-fit ${item.method === "POST" ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30"}`}
                >
                  {item.method}
                </Badge>
                <div>
                  <code className="text-primary font-mono text-sm">{item.path}</code>
                  <p className="text-muted-foreground text-sm mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Status Values */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Analysis Status Flow
          </h2>
          <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
            {["pending", "cloning", "analyzing", "generating", "completed", "failed"].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <Badge variant="outline" className={`${s === "completed" ? "bg-primary/10 text-primary border-primary/30" : s === "failed" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-card text-muted-foreground"}`}>
                  {s}
                </Badge>
                {i < arr.length - 2 && <span className="text-muted-foreground">→</span>}
                {i === arr.length - 3 && <span className="text-muted-foreground mx-1">or</span>}
              </span>
            ))}
          </div>
          <p className="text-muted-foreground text-sm mt-4">
            Poll <code className="text-primary font-mono">/api/repos/:id/status</code> every 2 seconds until status is <code className="text-primary font-mono">completed</code> or <code className="text-primary font-mono">failed</code>.
          </p>
        </section>

        {/* Limitations */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Limitations</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="text-primary shrink-0">—</span> Only <strong className="text-foreground">public</strong> GitHub repositories are supported.</li>
            <li className="flex gap-2"><span className="text-primary shrink-0">—</span> Very large repos (1000+ files) may be partially analyzed due to context limits.</li>
            <li className="flex gap-2"><span className="text-primary shrink-0">—</span> Generated content is AI-produced — always review before using in production.</li>
            <li className="flex gap-2"><span className="text-primary shrink-0">—</span> Analysis typically takes 20–90 seconds depending on repository size.</li>
          </ul>
        </section>

        <div className="border-t border-border pt-8 text-center">
          <Link href="/">
            <span className="font-mono text-primary hover:underline cursor-pointer text-sm">← Start analyzing a repository</span>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
