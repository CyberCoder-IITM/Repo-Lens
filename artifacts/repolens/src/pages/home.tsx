import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search, Github, Activity, FolderGit2, CheckCircle2, XCircle, Clock, Loader2, GitBranch } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { 
  useListRepos, 
  useGetReposSummary, 
  useAnalyzeRepo,
  getListReposQueryKey,
  getGetReposSummaryQueryKey
} from "@workspace/api-client-react";

import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const analyzeFormSchema = z.object({
  repoUrl: z.string().url("Please enter a valid URL").refine((val) => {
    return val.includes("github.com/");
  }, "Only GitHub repository URLs are supported"),
});

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: repos, isLoading: isLoadingRepos, isError: isErrorRepos } = useListRepos({
    query: { queryKey: getListReposQueryKey() }
  });
  
  const { data: summary, isLoading: isLoadingSummary } = useGetReposSummary({
    query: { queryKey: getGetReposSummaryQueryKey() }
  });

  const analyzeMutation = useAnalyzeRepo({
    mutation: {
      onSuccess: (repo) => {
        queryClient.invalidateQueries({ queryKey: getListReposQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetReposSummaryQueryKey() });
        setLocation(`/repo/${repo.id}`);
      }
    }
  });

  const form = useForm<z.infer<typeof analyzeFormSchema>>({
    resolver: zodResolver(analyzeFormSchema),
    defaultValues: {
      repoUrl: "",
    },
  });

  function onSubmit(values: z.infer<typeof analyzeFormSchema>) {
    analyzeMutation.mutate({ data: { repoUrl: values.repoUrl } });
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col pt-16 md:pt-24 pb-12 px-4 container mx-auto max-w-5xl">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">
            Understand any codebase.
          </h1>
          <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 font-mono px-2">
            Automated architecture mapping, documentation generation, and structural analysis for GitHub repositories.
          </p>

          <div className="max-w-xl mx-auto relative">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="relative flex items-center">
                <FormField
                  control={form.control}
                  name="repoUrl"
                  render={({ field }) => (
                    <FormItem className="w-full relative">
                      <FormControl>
                        <div className="relative group">
                          <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input 
                            placeholder="https://github.com/owner/repo" 
                            className="w-full pl-12 pr-32 py-6 text-lg bg-card/50 backdrop-blur-sm border-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary transition-all rounded-xl shadow-lg"
                            disabled={analyzeMutation.isPending}
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <div className="absolute top-1/2 -translate-y-1/2 right-2">
                        <Button 
                          type="submit" 
                          size="lg"
                          disabled={analyzeMutation.isPending}
                          className="rounded-lg shadow-primary/20 shadow-lg"
                        >
                          {analyzeMutation.isPending ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing</>
                          ) : (
                            <>Analyze <Search className="ml-2 w-4 h-4" /></>
                          )}
                        </Button>
                      </div>
                      <FormMessage className="text-left mt-2 pl-2" />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-12 md:mb-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150 fill-mode-both">
          <Card className="bg-card/40 backdrop-blur-md border-primary/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono font-medium text-muted-foreground">Total Analyzed</CardTitle>
              <Activity className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold">{summary?.totalRepos || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card/40 backdrop-blur-md border-green-500/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono font-medium text-muted-foreground">Completed</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold text-green-500">{summary?.completedRepos || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card/40 backdrop-blur-md border-yellow-500/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono font-medium text-muted-foreground">In Progress</CardTitle>
              <Clock className="w-4 h-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold text-yellow-500">{summary?.pendingRepos || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card/40 backdrop-blur-md border-destructive/20">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-mono font-medium text-muted-foreground">Failed</CardTitle>
              <XCircle className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold text-destructive">{summary?.failedRepos || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Repos */}
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300 fill-mode-both">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FolderGit2 className="w-6 h-6 text-primary" />
              Recent Analyses
            </h2>
            
            {summary?.popularTechStack && summary.popularTechStack.length > 0 && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-mono">Popular:</span>
                {summary.popularTechStack.slice(0, 3).map(tech => (
                  <Badge key={tech.tech} variant="secondary" className="font-mono text-xs">
                    {tech.tech}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoadingRepos ? (
              Array(6).fill(0).map((_, i) => (
                <Card key={i} className="bg-card/30 border-muted">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : isErrorRepos ? (
              <div className="col-span-full p-8 text-center text-destructive bg-destructive/10 rounded-lg border border-destructive/20 font-mono">
                Failed to load recent repositories.
              </div>
            ) : repos?.length === 0 ? (
              <div className="col-span-full p-12 text-center text-muted-foreground bg-card/20 rounded-lg border border-dashed font-mono">
                No repositories analyzed yet. Enter a URL above to start.
              </div>
            ) : (
              repos?.slice(0, 9).map((repo) => (
                <Link key={repo.id} href={`/repo/${repo.id}`}>
                  <Card className="bg-card/40 hover:bg-card/80 border-muted hover:border-primary/50 transition-all cursor-pointer group h-full flex flex-col shadow-sm hover:shadow-primary/10 hover:shadow-xl">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base truncate group-hover:text-primary transition-colors flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        {repo.repoName}
                      </CardTitle>
                      <CardDescription className="truncate font-mono text-xs">
                        {repo.owner}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto pt-0">
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant={repo.status === 'completed' ? 'default' : repo.status === 'failed' ? 'destructive' : 'secondary'}
                          className={`font-mono text-[10px] uppercase ${repo.status === 'completed' ? 'bg-primary/20 text-primary hover:bg-primary/30' : ''}`}
                        >
                          {repo.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(repo.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
