import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Github, 
  ArrowLeft, 
  ExternalLink, 
  FileText, 
  Code2, 
  GitMerge,
  AlertCircle,
  FileCode2,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  XCircle
} from "lucide-react";

import { 
  useGetRepo, 
  useGetRepoStatus,
  getGetRepoQueryKey,
  getGetRepoStatusQueryKey
} from "@workspace/api-client-react";

import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { MermaidDiagram } from "@/components/mermaid-diagram";

function getTechColor(tech: string): string {
  const t = tech.toLowerCase();
  if (t.includes('typescript') || t.includes('ts')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  if (t.includes('javascript') || t.includes('js')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (t.includes('python') || t.includes('py')) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (t.includes('react')) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
  if (t.includes('node') || t.includes('express')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (t.includes('rust')) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  if (t.includes('go')) return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
  if (t.includes('css') || t.includes('tailwind')) return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
  if (t.includes('html')) return 'bg-red-500/20 text-red-400 border-red-500/30';
  return 'bg-primary/20 text-primary border-primary/30';
}

export default function RepoDashboard() {
  const params = useParams();
  const repoId = parseInt(params.id || "0", 10);
  const [activeTab, setActiveTab] = useState("readme");

  const { 
    data: repo, 
    isLoading: isLoadingRepo,
    isError: isErrorRepo,
    refetch: refetchRepo
  } = useGetRepo(repoId, { 
    query: { 
      enabled: !!repoId, 
      queryKey: getGetRepoQueryKey(repoId) 
    } 
  });

  const isCompleted = repo?.status === 'completed';
  const isFailed = repo?.status === 'failed';
  const isPolling = !isCompleted && !isFailed;

  const { data: statusData } = useGetRepoStatus(repoId, {
    query: {
      enabled: !!repoId && isPolling,
      queryKey: getGetRepoStatusQueryKey(repoId),
      refetchInterval: isPolling ? 2000 : false,
    }
  });

  useEffect(() => {
    // When status changes to completed or failed, refetch the repo to get the generated data
    if (statusData && (statusData.status === 'completed' || statusData.status === 'failed')) {
      refetchRepo();
    }
  }, [statusData?.status, refetchRepo]);

  if (!repoId) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center font-mono text-muted-foreground">Invalid repository ID.</div>
        </div>
      </Layout>
    );
  }

  if (isErrorRepo) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-5xl flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4 opacity-80" />
            <h2 className="text-2xl font-bold mb-2">Repository Not Found</h2>
            <p className="text-muted-foreground mb-6 font-mono text-sm">
              The requested analysis could not be found or an error occurred.
            </p>
            <Link href="/">
              <Button variant="outline" className="font-mono">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const currentStatus = statusData?.status || repo?.status;
  const progress = statusData?.progress || (currentStatus === 'completed' ? 100 : 0);
  const currentStep = statusData?.currentStep || (currentStatus === 'completed' ? 'Analysis complete' : 'Initializing...');
  const errorMsg = statusData?.errorMessage || repo?.errorMessage;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
            </Link>
            
            {isLoadingRepo ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-5 w-40" />
              </div>
            ) : (
              <>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
                  <Github className="w-8 h-8 text-muted-foreground" />
                  {repo?.repoName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-mono text-muted-foreground">
                  <a 
                    href={repo?.repoUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center hover:text-primary transition-colors"
                  >
                    {repo?.owner}/{repo?.repoName}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                  {repo?.fileCount && (
                    <span className="flex items-center gap-1">
                      <FileCode2 className="w-4 h-4" /> {repo.fileCount} files
                    </span>
                  )}
                  {repo?.createdAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" /> {new Date(repo.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          
          {/* Status Badge & Tech Stack */}
          <div className="flex flex-col items-start md:items-end gap-3">
            {isLoadingRepo ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <Badge 
                variant={isCompleted ? 'default' : isFailed ? 'destructive' : 'secondary'}
                className={`font-mono uppercase px-3 py-1 text-xs ${
                  isCompleted ? 'bg-primary/20 text-primary border border-primary/30' : 
                  isFailed ? '' : 
                  'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                }`}
              >
                {isPolling && <RefreshCw className="w-3 h-3 mr-2 animate-spin" />}
                {currentStatus}
              </Badge>
            )}
            
            {repo?.techStack && repo.techStack.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end max-w-md">
                {repo.techStack.map(tech => (
                  <Badge key={tech} variant="outline" className={`font-mono text-xs border ${getTechColor(tech)}`}>
                    {tech}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Polling / Progress State */}
        {isPolling && (
          <div className="bg-card/50 border border-primary/20 rounded-xl p-8 mb-8 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between mb-4 font-mono">
              <span className="text-primary font-bold flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {currentStep}
              </span>
              <span className="text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-in-out" 
                style={{ width: `${progress}%` }} 
              />
            </Progress>
            <p className="text-sm text-muted-foreground mt-4 font-mono">
              RepoLens is deeply analyzing the codebase. This may take a minute or two depending on repository size.
            </p>
          </div>
        )}

        {/* Error State */}
        {isFailed && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-8 mb-8 backdrop-blur-sm">
            <h3 className="text-xl font-bold text-destructive mb-2 flex items-center gap-2">
              <XCircle className="w-6 h-6" /> Analysis Failed
            </h3>
            <p className="font-mono text-sm text-destructive/80 mb-4">
              {errorMsg || "An unknown error occurred during analysis."}
            </p>
            <Button variant="outline" onClick={() => refetchRepo()} className="font-mono">
              <RefreshCw className="w-4 h-4 mr-2" /> Try Again
            </Button>
          </div>
        )}

        {/* Results */}
        {(isCompleted || (repo?.generatedReadme && !isPolling)) && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col animate-in fade-in duration-700">
            <TabsList className="bg-card/50 border border-border w-full justify-start rounded-t-xl rounded-b-none p-1 h-auto flex-wrap gap-1">
              <TabsTrigger 
                value="readme" 
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-mono text-xs md:text-sm py-2 px-3 md:px-4 rounded-md"
              >
                <FileText className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Overview</span>
                <span className="inline md:hidden text-xs ml-1">Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="docstrings" 
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-mono text-xs md:text-sm py-2 px-3 md:px-4 rounded-md"
                disabled={!repo?.generatedDocstrings}
              >
                <Code2 className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Docstrings</span>
                <span className="inline md:hidden text-xs ml-1">Docs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="architecture" 
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-mono text-xs md:text-sm py-2 px-3 md:px-4 rounded-md"
                disabled={!repo?.generatedArchitecture}
              >
                <GitMerge className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Architecture</span>
                <span className="inline md:hidden text-xs ml-1">Arch</span>
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 bg-card border border-t-0 border-border rounded-b-xl relative overflow-hidden">
              <TabsContent value="readme" className="m-0 p-6 md:p-8 max-w-none prose prose-invert prose-primary prose-pre:bg-muted prose-pre:border prose-pre:border-border font-sans focus:outline-none">
                {repo?.generatedReadme ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {repo.generatedReadme}
                  </ReactMarkdown>
                ) : (
                  <div className="text-muted-foreground font-mono text-center py-12">No overview generated.</div>
                )}
              </TabsContent>
              
              <TabsContent value="docstrings" className="m-0 p-0 focus:outline-none h-full">
                {repo?.generatedDocstrings ? (
                  <pre className="m-0 p-6 md:p-8 bg-transparent text-sm font-mono text-foreground overflow-auto">
                    <code>{repo.generatedDocstrings}</code>
                  </pre>
                ) : (
                  <div className="text-muted-foreground font-mono text-center py-12">No docstrings generated.</div>
                )}
              </TabsContent>
              
              <TabsContent value="architecture" className="m-0 p-6 focus:outline-none">
                {repo?.generatedArchitecture ? (
                  <div className="w-full flex justify-center">
                    <MermaidDiagram chart={repo.generatedArchitecture} />
                  </div>
                ) : (
                  <div className="text-muted-foreground font-mono text-center py-12">No architecture diagram generated.</div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
