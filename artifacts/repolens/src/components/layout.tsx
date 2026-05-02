import React from "react";
import { Hexagon } from "lucide-react";
import { Link } from "wouter";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
      <header className="border-b sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Hexagon className="w-6 h-6 text-primary" />
            <span className="font-mono font-bold text-lg tracking-tight">RepoLens</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">
              GitHub
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Docs
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <footer className="border-t py-6 mt-auto">
        <div className="container mx-auto px-4 flex justify-between items-center text-xs font-mono text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} RepoLens</span>
          <span>v0.1.0-alpha</span>
        </div>
      </footer>
    </div>
  );
}
