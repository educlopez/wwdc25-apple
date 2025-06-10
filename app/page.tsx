"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Apple,
  Wifi,
  WifiOff,
  ExternalLink,
  Clock,
  Calendar,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { track } from "@vercel/analytics";

interface WWDCUpdate {
  id: string;
  timestamp: string;
  type: "apple-official" | "9to5mac" | "live";
  title: string;
  description: string;
  author?: string;
  url?: string;
  source: string;
  isBreaking?: boolean;
}

interface LiveStatus {
  isLive: boolean;
  spainTime: string;
  pacificTime: string;
  keynoteStartsIn: number;
  currentHour: number;
  keynoteHour: number;
  keynoteEndHour: number;
  isWWDCWeek: boolean;
  currentDate: string;
  minutesUntilKeynote: number;
  minutesUntilEnd: number;
}

export default function WWDC25LiveTracker() {
  const [allUpdates, setAllUpdates] = useState<WWDCUpdate[]>([]);
  const [appleUpdates, setAppleUpdates] = useState<WWDCUpdate[]>([]);
  const [macUpdates, setMacUpdates] = useState<WWDCUpdate[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [clientTime, setClientTime] = useState(new Date());
  const [newContentIndicator, setNewContentIndicator] = useState(false);
  const [nextUpdateIn, setNextUpdateIn] = useState(300);
  const [isFetchingInBackground, setIsFetchingInBackground] = useState(false);
  const previousUpdatesRef = useRef<string[]>([]);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const [macrumorsUpdates, setMacrumorsUpdates] = useState<WWDCUpdate[]>([]);

  const [techcrunchUpdates, setTechcrunchUpdates] = useState<WWDCUpdate[]>([]);

  // Helper function to check if article is breaking (today or last hour)
  const isBreakingNews = (publishedAt: string, title: string) => {
    const articleTime = new Date(publishedAt);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const isLastHour = articleTime >= oneHourAgo;
    const isToday = articleTime >= todayStart;
    const hasUrgentKeywords =
      title.toLowerCase().includes("breaking") ||
      title.toLowerCase().includes("live") ||
      title.toLowerCase().includes("just announced") ||
      title.toLowerCase().includes("announces") ||
      title.toLowerCase().includes("unveils") ||
      title.toLowerCase().includes("reveals") ||
      title.toLowerCase().includes("wwdc 2025") ||
      title.toLowerCase().includes("ios 26") ||
      title.toLowerCase().includes("ios26") ||
      title.toLowerCase().includes("ipados 26") ||
      title.toLowerCase().includes("ipados26") ||
      title.toLowerCase().includes("macos 26") ||
      title.toLowerCase().includes("macos26") ||
      title.toLowerCase().includes("tahoe") ||
      title.toLowerCase().includes("watchos 11") ||
      title.toLowerCase().includes("watchos11") ||
      title.toLowerCase().includes("watchos 12") ||
      title.toLowerCase().includes("watchos12") ||
      title.toLowerCase().includes("visionos 3") ||
      title.toLowerCase().includes("visionos3") ||
      title.toLowerCase().includes("visionos 4") ||
      title.toLowerCase().includes("visionos4") ||
      title.toLowerCase().includes("tvos 20") ||
      title.toLowerCase().includes("tvos20") ||
      title.toLowerCase().includes("tvos 21") ||
      title.toLowerCase().includes("tvos21") ||
      title.toLowerCase().includes("new design");

    return isLastHour || (isToday && hasUrgentKeywords) || hasUrgentKeywords;
  };

  // Update client time every second for accurate countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setClientTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchWWDC25Data = useCallback(
    async (isBackgroundFetch = false) => {
      // Prevent multiple simultaneous fetches
      if (isRefreshing && !isBackgroundFetch) return;

      if (isBackgroundFetch) {
        setIsFetchingInBackground(true);
      } else {
        setIsRefreshing(true);
      }

      setApiErrors([]);

      try {
        console.log("🔄 Fetching WWDC25 data with cache-busting...");

        // Add cache-busting timestamp to all requests
        const timestamp = Date.now();

        // Fetch live status first
        const liveStatusResponse = await fetch(
          `/api/live-status?t=${timestamp}`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );
        const liveStatusData = await liveStatusResponse.json();
        setLiveStatus(liveStatusData);

        console.log("📡 Live Status:", {
          isLive: liveStatusData.isLive,
          currentHour: liveStatusData.currentHour,
          spainTime: liveStatusData.spainTime,
        });

        // Use ref for previous updates to avoid dependency issues
        const previousIds = previousUpdatesRef.current;

        // Fetch from all RSS sources
        const [appleRssData, macRssData, macrumorsRssData, techcrunchRssData] =
          await Promise.allSettled([
            fetch(`/api/apple-rss?t=${timestamp}`, {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
              },
            }).then(async (res) => {
              if (!res.ok) {
                const errorText = await res.text();
                console.error(`Apple RSS error response: ${errorText}`);
                throw new Error(
                  `Apple RSS: ${res.status} - ${errorText.substring(0, 100)}`
                );
              }

              const contentType = res.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                const errorText = await res.text();
                console.error(`Apple RSS non-JSON response: ${errorText}`);
                throw new Error(`Apple RSS: Expected JSON, got ${contentType}`);
              }

              return res.json();
            }),
            fetch(`/api/9to5mac-rss?t=${timestamp}`, {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
              },
            }).then(async (res) => {
              if (!res.ok) {
                const errorText = await res.text();
                console.error(`9to5Mac RSS error response: ${errorText}`);
                throw new Error(
                  `9to5Mac RSS: ${res.status} - ${errorText.substring(0, 100)}`
                );
              }

              const contentType = res.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                const errorText = await res.text();
                console.error(`9to5Mac RSS non-JSON response: ${errorText}`);
                throw new Error(
                  `9to5Mac RSS: Expected JSON, got ${contentType}`
                );
              }

              return res.json();
            }),
            fetch(`/api/macrumors-rss?t=${timestamp}`, {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
              },
            }).then(async (res) => {
              if (!res.ok) {
                const errorText = await res.text();
                console.error(`Macrumors RSS error response: ${errorText}`);
                throw new Error(
                  `Macrumors RSS: ${res.status} - ${errorText.substring(
                    0,
                    100
                  )}`
                );
              }

              const contentType = res.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                const errorText = await res.text();
                console.error(`Macrumors RSS non-JSON response: ${errorText}`);
                throw new Error(
                  `Macrumors RSS: Expected JSON, got ${contentType}`
                );
              }

              return res.json();
            }),

            fetch(`/api/techcrunch-rss?t=${timestamp}`, {
              cache: "no-store",
              headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
              },
            }).then(async (res) => {
              if (!res.ok) {
                const errorText = await res.text();
                console.error(`TechCrunch RSS error response: ${errorText}`);
                throw new Error(
                  `TechCrunch RSS: ${res.status} - ${errorText.substring(
                    0,
                    100
                  )}`
                );
              }

              const contentType = res.headers.get("content-type");
              if (!contentType || !contentType.includes("application/json")) {
                const errorText = await res.text();
                console.error(`TechCrunch RSS non-JSON response: ${errorText}`);
                throw new Error(
                  `TechCrunch RSS: Expected JSON, got ${contentType}`
                );
              }

              return res.json();
            }),
          ]);

        const allArticles: WWDCUpdate[] = [];
        const appleAllUpdates: WWDCUpdate[] = [];
        const macAllUpdates: WWDCUpdate[] = [];
        const macrumorsAllUpdates: WWDCUpdate[] = [];
        const techcrunchAllUpdates: WWDCUpdate[] = [];
        const errors: string[] = [];

        // Process Apple Official RSS data
        if (
          appleRssData.status === "fulfilled" &&
          appleRssData.value.articles
        ) {
          console.log(
            "🍎 Apple RSS returned",
            appleRssData.value.articles.length,
            "articles"
          );
          const rssArticles = appleRssData.value.articles.map(
            (article: any) => ({
              id: `apple-${article.url}`,
              timestamp: article.publishedAt,
              type: "apple-official" as const,
              title: article.title,
              description: article.description,
              url: article.url,
              source: article.source.name,
              isBreaking: isBreakingNews(article.publishedAt, article.title),
            })
          );
          appleAllUpdates.push(...rssArticles);
          allArticles.push(...rssArticles);
        } else if (appleRssData.status === "rejected") {
          errors.push(`Apple RSS: ${appleRssData.reason.message}`);
          console.error("❌ Apple RSS failed:", appleRssData.reason);
        }

        // Process 9to5Mac RSS data
        if (macRssData.status === "fulfilled" && macRssData.value.articles) {
          console.log(
            "🔥 9to5Mac RSS returned",
            macRssData.value.articles.length,
            "articles"
          );
          const macArticles = macRssData.value.articles.map((article: any) => ({
            id: `9to5mac-${article.url}`,
            timestamp: article.publishedAt,
            type: "9to5mac" as const,
            title: article.title,
            description: article.description,
            author: article.author,
            url: article.url,
            source: article.source.name,
            isBreaking: isBreakingNews(article.publishedAt, article.title),
          }));
          macAllUpdates.push(...macArticles);
          allArticles.push(...macArticles);
        } else if (macRssData.status === "rejected") {
          errors.push(`9to5Mac RSS: ${macRssData.reason.message}`);
          console.error("❌ 9to5Mac RSS failed:", macRssData.reason);
        }

        // Process Macrumors RSS data
        if (
          macrumorsRssData.status === "fulfilled" &&
          macrumorsRssData.value.articles
        ) {
          console.log(
            "💻 Macrumors RSS returned",
            macrumorsRssData.value.articles.length,
            "articles"
          );
          const macrumorsArticles = macrumorsRssData.value.articles.map(
            (article: any) => ({
              id: `macrumors-${article.url}`,
              timestamp: article.publishedAt,
              type: "macrumors" as const,
              title: article.title,
              description: article.description,
              url: article.url,
              source: article.source.name,
              isBreaking: isBreakingNews(article.publishedAt, article.title),
            })
          );
          macrumorsAllUpdates.push(...macrumorsArticles);
          allArticles.push(...macrumorsArticles);
        } else if (macrumorsRssData.status === "rejected") {
          errors.push(`Macrumors RSS: ${macrumorsRssData.reason.message}`);
          console.error("❌ Macrumors RSS failed:", macrumorsRssData.reason);
        }

        // Process TechCrunch RSS data
        if (
          techcrunchRssData.status === "fulfilled" &&
          techcrunchRssData.value.articles
        ) {
          console.log(
            "💻 TechCrunch RSS returned",
            techcrunchRssData.value.articles.length,
            "articles"
          );
          const techcrunchArticles = techcrunchRssData.value.articles.map(
            (article: any) => ({
              id: `techcrunch-${article.url}`,
              timestamp: article.publishedAt,
              type: "techcrunch" as const,
              title: article.title,
              description: article.description,
              url: article.url,
              source: article.source.name,
              isBreaking: isBreakingNews(article.publishedAt, article.title),
            })
          );
          techcrunchAllUpdates.push(...techcrunchArticles);
          allArticles.push(...techcrunchArticles);
        } else if (techcrunchRssData.status === "rejected") {
          errors.push(`TechCrunch RSS: ${techcrunchRssData.reason.message}`);
          console.error("❌ TechCrunch RSS failed:", techcrunchRssData.reason);
        }

        // Sort all arrays by timestamp and breaking news priority
        const sortUpdates = (updates: WWDCUpdate[]) => {
          return updates.sort((a, b) => {
            // Live updates always first
            if (a.type === "live" && b.type !== "live") return -1;
            if (a.type !== "live" && b.type === "live") return 1;

            // Then breaking news
            if (a.isBreaking && !b.isBreaking) return -1;
            if (!a.isBreaking && b.isBreaking) return 1;

            // Finally by timestamp
            return (
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        };

        const sortedAllUpdates = sortUpdates(allArticles).slice(0, 100);
        const sortedAppleUpdates = sortUpdates(appleAllUpdates).slice(0, 50);
        const sortedMacUpdates = sortUpdates(macAllUpdates).slice(0, 30);
        const sortedMacrumorsUpdates = sortUpdates(macrumorsAllUpdates).slice(
          0,
          20
        );

        const sortedTechcrunchUpdates = sortUpdates(techcrunchAllUpdates).slice(
          0,
          10
        );

        // Check if there are new updates
        const newIds = sortedAllUpdates.map((update) => update.id);
        const hasNewContent = newIds.some((id) => !previousIds.includes(id));

        if (hasNewContent && !isLoading) {
          setNewContentIndicator(true);
          console.log("🆕 New content detected!");

          // Show subtle notification for new content
          if (isBackgroundFetch) {
            toast({
              title: "New updates available",
              description: "Fresh content has been loaded automatically",
              duration: 3000,
            });
          }

          // Flash animation on new content
          setTimeout(() => {
            setNewContentIndicator(false);
          }, 5000);
        }

        // Update the ref with current update IDs for next comparison
        previousUpdatesRef.current = newIds;

        // Smooth update - use transition effect
        setAllUpdates(sortedAllUpdates);
        setAppleUpdates(sortedAppleUpdates);
        setMacUpdates(sortedMacUpdates);
        setMacrumorsUpdates(sortedMacrumorsUpdates);
        setTechcrunchUpdates(sortedTechcrunchUpdates);
        setLastUpdate(new Date());
        setIsConnected(true);
        setApiErrors(errors);

        const totalUpdates = allArticles.length;
        const breakingCount = allArticles.filter((u) => u.isBreaking).length;

        console.log(
          `📊 Total updates: ${totalUpdates} (Apple: ${appleAllUpdates.length}, 9to5Mac: ${macAllUpdates.length}, Breaking: ${breakingCount})`
        );

        if (errors.length > 0 && !isBackgroundFetch) {
          toast({
            title: "Some RSS feeds failed",
            description: `${errors.length} RSS feed(s) had errors. Check console for details.`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("❌ Failed to fetch WWDC25 data:", error);
        setIsConnected(false);

        if (!isBackgroundFetch) {
          toast({
            title: "Connection error",
            description: "Could not load updates. Will retry automatically.",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsFetchingInBackground(false);
      }
    },
    [isLoading, isRefreshing, toast]
  );

  // Single useEffect for interval and countdown
  useEffect(() => {
    if (!autoRefresh) {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      return;
    }
    setNextUpdateIn(300); // Reset countdown on enable
    refreshIntervalRef.current = setInterval(() => {
      setNextUpdateIn((prev) => {
        if (prev <= 1) {
          fetchWWDC25Data(true);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [autoRefresh, fetchWWDC25Data]);

  // Fetch once on mount so updates are shown immediately
  useEffect(() => {
    fetchWWDC25Data();
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    track("tab_change", { tab: value });
  };

  const handleAutoRefreshToggle = () => {
    setAutoRefresh((prev) => !prev);
  };

  const handleManualRefresh = () => {
    fetchWWDC25Data();
    setNextUpdateIn(300);
  };

  const handleAppleEventClick = () => {
    track("apple_event_click", {
      timestamp: new Date().toISOString(),
      is_live: liveStatus?.isLive || false,
    });
  };

  const handleTwitterClick = () => {
    track("twitter_click", {
      timestamp: new Date().toISOString(),
    });
  };

  const handleNewsClick = (update: WWDCUpdate) => {
    track("news_click", {
      source: update.source,
      type: update.type,
      is_breaking: update.isBreaking || false,
      timestamp: new Date().toISOString(),
    });
  };

  const getTypeColor = (type: string, isBreaking?: boolean) => {
    if (isBreaking)
      return "bg-gradient-to-r from-red-500 to-pink-500 shadow-red-500/25";

    switch (type) {
      case "live":
        return "bg-gradient-to-r from-red-500 to-pink-500 shadow-red-500/25";
      case "9to5mac":
        return "bg-gradient-to-r from-blue-500 to-indigo-500 shadow-blue-500/25";
      case "apple-official":
        return "bg-gradient-to-r from-purple-500 to-violet-500 shadow-purple-500/25";
      default:
        return "bg-gradient-to-r from-gray-500 to-slate-500 shadow-gray-500/25";
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "live":
        return "LIVE";
      case "9to5mac":
        return "9TO5MAC";
      case "apple-official":
        return "APPLE";
      default:
        return "UPDATE";
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor(
      (now.getTime() - time.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getCurrentUpdates = () => {
    switch (activeTab) {
      case "all":
        return allUpdates;
      case "apple":
        return appleUpdates;
      case "9to5mac":
        return macUpdates;
      case "macrumors":
        return macrumorsUpdates;
      case "techcrunch":
        return techcrunchUpdates;
      case "breaking":
        return allUpdates.filter((u) => u.isBreaking);
      default:
        return allUpdates;
    }
  };

  const currentUpdates = getCurrentUpdates();
  const formattedLastUpdate = lastUpdate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const formatNextUpdate = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* WWDC25 Background with Apple-style Glassmorphism */}
      <div className="fixed inset-0">
        {/* Floating Color Orbs */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-blue-400/60 to-cyan-400/60 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-32 w-80 h-80 bg-gradient-to-r from-purple-400/60 to-pink-400/60 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-1/3 w-72 h-72 bg-gradient-to-r from-green-400/60 to-emerald-400/60 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-20 w-64 h-64 bg-gradient-to-r from-yellow-400/60 to-orange-400/60 rounded-full blur-3xl animate-pulse delay-3000"></div>

        {/* Glass overlay */}
        <div className="absolute inset-0 bg-white/10 dark:bg-gray-900/10 backdrop-blur-sm"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white/10 dark:bg-gray-900/10 backdrop-blur-2xl border-b border-white/30 dark:border-white/10 sticky top-0 z-50 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center space-x-4">
                {/* Apple Logo with Glass Effect */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-pink-400/20 rounded-2xl blur-xl"></div>
                  <div className="relative bg-white/30 dark:bg-gray-800/30 backdrop-blur-xl rounded-2xl p-3 border border-white/20 dark:border-gray-700/20">
                    <Apple className="h-8 w-8 text-gray-800 dark:text-white" />
                  </div>
                </div>
                <div>
                  {/* WWDC25 Rainbow Text */}
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 via-green-500 via-yellow-500 via-orange-500 to-pink-500 bg-clip-text text-transparent">
                    WWDC25
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {liveStatus?.isLive ? (
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1"></span>
                        LIVE
                      </span>
                    ) : liveStatus?.minutesUntilKeynote &&
                      liveStatus.minutesUntilKeynote < 30 ? (
                      <span className="flex items-center">
                        <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse mr-1"></span>
                        Starting soon
                      </span>
                    ) : (
                      "Sleek peek"
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right text-sm hidden md:block">
                  <div className="text-gray-800 dark:text-white font-medium">
                    Spain: {liveStatus?.spainTime || "--:--"}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    California: {liveStatus?.pacificTime || "--:--"}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border-white/20 dark:border-gray-700/20 hover:bg-white/30 dark:hover:bg-gray-800/30 hidden md:flex"
                  >
                    <a
                      href="https://www.apple.com/apple-events/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1"
                      onClick={handleAppleEventClick}
                    >
                      <Apple className="h-3 w-3" />
                      <span>Watch Keynote</span>
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border-white/20 dark:border-gray-700/20 hover:bg-white/30 dark:hover:bg-gray-800/30"
                  >
                    <a
                      href="https://x.com/educalvolpz"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1"
                      onClick={handleTwitterClick}
                    >
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span className="hidden md:inline">@educalvolpz</span>
                    </a>
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <div className="flex items-center space-x-1">
                      <Wifi className="h-4 w-4 text-green-500" />
                      {isFetchingInBackground && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                  <Button
                    onClick={handleAutoRefreshToggle}
                    variant="outline"
                    size="sm"
                    className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border-white/20 dark:border-gray-700/20 hover:bg-white/30 dark:hover:bg-gray-800/30"
                  >
                    {autoRefresh ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    <span className="hidden md:inline ml-1">
                      {autoRefresh ? "Pause" : "Resume"}
                    </span>
                  </Button>
                  <Button
                    onClick={handleManualRefresh}
                    variant="outline"
                    size="sm"
                    disabled={isRefreshing}
                    className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border-white/20 dark:border-gray-700/20 hover:bg-white/30 dark:hover:bg-gray-800/30"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${
                        isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                    <span className="hidden md:inline ml-1">Refresh</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* API Error Alert */}
          {apiErrors.length > 0 && (
            <Alert className="mb-6 bg-yellow-50/20 dark:bg-yellow-950/20 backdrop-blur-2xl border border-yellow-400/30 ring-1 ring-yellow-400/20">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-gray-800 dark:text-white">
                <strong>RSS Issues:</strong> {apiErrors.join(", ")}
              </AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
            {[
              {
                title: "Total Updates",
                value: allUpdates.length,
                desc: "All sources",
              },
              {
                title: "9to5Mac",
                value: macUpdates.length,
                desc: "Direct RSS feed",
              },
              {
                title: "Apple Official",
                value: appleUpdates.length,
                desc: "Apple RSS feeds",
              },
              {
                title: autoRefresh ? "Next Update" : "Last Updated",
                value: autoRefresh
                  ? formatNextUpdate(nextUpdateIn)
                  : formattedLastUpdate,
                desc: autoRefresh
                  ? "Auto-refresh every 5m"
                  : "Manual refresh only",
              },
            ].map((stat, index) => (
              <Card
                key={index}
                className={`bg-white/20 dark:bg-gray-900/20 backdrop-blur-2xl border border-white/30 dark:border-white/10 hover:bg-white/30 dark:hover:bg-gray-900/30 transition-all duration-300 shadow-lg ring-1 ring-white/20 dark:ring-white/10 ${
                  index === 3 && newContentIndicator
                    ? "border-green-400/50 ring-green-400/30 shadow-green-500/20"
                    : ""
                } ${
                  index === 3 && isFetchingInBackground
                    ? "border-blue-400/50 ring-blue-400/30 shadow-blue-500/20"
                    : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                    {stat.title}
                    {index === 3 && isFetchingInBackground && (
                      <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full opacity-75"></div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 bg-white/20" />
                  ) : (
                    <div className="text-2xl font-bold text-gray-800 dark:text-white transition-all duration-300">
                      {stat.value}
                    </div>
                  )}
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {stat.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Live WWDC25 Feed */}
          <Card
            className={`bg-white/20 dark:bg-gray-900/20 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-lg ring-1 ring-white/20 dark:ring-white/10 transition-all duration-500 ${
              newContentIndicator
                ? "border-green-400/50 ring-green-400/30 shadow-green-500/20"
                : ""
            } ${
              isFetchingInBackground
                ? "border-blue-400/30 ring-blue-400/20 shadow-blue-500/20"
                : ""
            }`}
          >
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-gray-800 dark:text-white">
                <div
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    liveStatus?.isLive
                      ? "bg-red-500 animate-pulse"
                      : liveStatus?.minutesUntilKeynote &&
                        liveStatus.minutesUntilKeynote < 30
                      ? "bg-orange-500 animate-pulse"
                      : "bg-green-500"
                  }`}
                ></div>
                <span>Live WWDC25 Feed</span>
                {newContentIndicator && (
                  <Badge className="bg-green-500 text-white shadow-lg border-0 ml-2">
                    New Content
                  </Badge>
                )}
                {isFetchingInBackground && (
                  <Badge className="bg-blue-500 text-white shadow-lg border-0 ml-2">
                    Updating...
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Real-time updates from Apple's Worldwide Developers Conference
                2025 • Auto-refresh every 5 minutes • iOS 19/26 • macOS 15/16
              </CardDescription>

              <Tabs
                defaultValue="all"
                className="mt-2"
                onValueChange={handleTabChange}
              >
                <TabsList className="  bg-white/10 dark:bg-gray-800/10 backdrop-blur-2xl border border-white/30 dark:border-white/10 ring-1 ring-white/20 dark:ring-white/10">
                  <TabsTrigger
                    value="all"
                    className="data-[state=active]:bg-white/30 dark:data-[state=active]:bg-gray-700/30 data-[state=active]:shadow-md data-[state=active]:backdrop-blur-2xl transition-all duration-200"
                  >
                    All Updates
                  </TabsTrigger>
                  <TabsTrigger
                    value="9to5mac"
                    className="data-[state=active]:bg-white/30 dark:data-[state=active]:bg-gray-700/30 data-[state=active]:shadow-md data-[state=active]:backdrop-blur-2xl transition-all duration-200"
                  >
                    9to5Mac
                  </TabsTrigger>
                  <TabsTrigger
                    value="apple"
                    className="data-[state=active]:bg-white/30 dark:data-[state=active]:bg-gray-700/30 data-[state=active]:shadow-md data-[state=active]:backdrop-blur-2xl transition-all duration-200"
                  >
                    Apple Official
                  </TabsTrigger>
                  <TabsTrigger
                    value="macrumors"
                    className="data-[state=active]:bg-white/30 dark:data-[state=active]:bg-gray-700/30 data-[state=active]:shadow-md data-[state=active]:backdrop-blur-2xl transition-all duration-200"
                  >
                    Macrumors
                  </TabsTrigger>
                  <TabsTrigger
                    value="techcrunch"
                    className="data-[state=active]:bg-white/30 dark:data-[state=active]:bg-gray-700/30 data-[state=active]:shadow-md data-[state=active]:backdrop-blur-2xl transition-all duration-200"
                  >
                    TechCrunch
                  </TabsTrigger>
                  <TabsTrigger
                    value="breaking"
                    className="data-[state=active]:bg-white/30 dark:data-[state=active]:bg-gray-700/30 data-[state=active]:shadow-md data-[state=active]:backdrop-blur-2xl transition-all duration-200"
                  >
                    Breaking
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl rounded-lg p-4 border border-white/10 dark:border-gray-700/10"
                    >
                      <div className="flex items-start space-x-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Skeleton className="h-5 w-16 bg-white/20" />
                            <Skeleton className="h-4 w-24 bg-white/20" />
                          </div>
                          <Skeleton className="h-6 w-full mb-2 bg-white/20" />
                          <Skeleton className="h-4 w-full mb-1 bg-white/20" />
                          <Skeleton className="h-4 w-3/4 bg-white/20" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {currentUpdates.length > 0 ? (
                    currentUpdates.map((update, index) => (
                      <div
                        key={update.id}
                        className={`bg-white/20 dark:bg-gray-800/20 backdrop-blur-2xl rounded-lg p-4 border border-white/30 dark:border-white/10 transition-all duration-500 hover:bg-white/30 dark:hover:bg-gray-800/30 hover:shadow-lg ring-1 ring-white/20 dark:ring-white/10 ${
                          update.isBreaking
                            ? "border-red-400/50 bg-red-50/20 dark:bg-red-950/20 ring-red-400/30 shadow-red-500/20"
                            : ""
                        } ${
                          !previousUpdatesRef.current.includes(update.id)
                            ? "border-green-400/50 shadow-green-500/20 ring-green-400/30"
                            : ""
                        }`}
                        style={{
                          animationDelay: `${index * 100}ms`,
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge
                                className={`${getTypeColor(
                                  update.type,
                                  update.isBreaking
                                )} text-white border-0 transition-all duration-300`}
                              >
                                {getTypeName(update.type)}
                              </Badge>
                              {update.isBreaking && (
                                <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 shadow-lg shadow-red-500/25">
                                  BREAKING
                                </Badge>
                              )}
                              {!previousUpdatesRef.current.includes(
                                update.id
                              ) && (
                                <Badge className="bg-green-500 text-white border-0 shadow-lg shadow-green-500/25">
                                  NEW
                                </Badge>
                              )}
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {update.source}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-500 ml-auto">
                                {formatRelativeTime(update.timestamp)}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-800 dark:text-white mb-1 transition-all duration-300">
                              {update.title}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 transition-all duration-300">
                              {update.description}
                            </p>
                            {update.author && (
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                by {update.author}
                              </p>
                            )}
                          </div>
                          {update.url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="ml-2 shrink-0 hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200"
                            >
                              <a
                                href={update.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => handleNewsClick(update)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>
                        No {activeTab === "all" ? "updates" : activeTab} at the
                        moment
                      </p>
                      <p className="text-sm">
                        Updates will appear here when available
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <footer className="mt-12 text-center text-sm text-gray-600 dark:text-gray-400 pb-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-6">
                <a
                  href="https://www.apple.com/apple-events/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  onClick={handleAppleEventClick}
                >
                  <Apple className="h-4 w-4" />
                  <span>Official WWDC25 Event</span>
                </a>
                <a
                  href="https://9to5mac.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <span className="text-blue-500 font-bold">9to5</span>
                  <span>Mac Coverage</span>
                </a>
                <a
                  href="https://x.com/educalvolpz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  onClick={handleTwitterClick}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Follow @educalvolpz</span>
                </a>
              </div>
              <div className="text-center">
                <p className="font-medium">
                  WWDC25 Live Tracker • Auto-refresh every 5 minutes
                </p>
                <p className="mt-1 text-xs">
                  June 9-13, 2025 • Keynote: 19:00-21:00 Spain • iOS 19/26 •
                  macOS 15/16 • watchOS 11/12
                </p>
                <p className="mt-2">
                  {isConnected ? (
                    <span className="flex items-center justify-center">
                      <Wifi className="h-3 w-3 mr-1 text-green-500" />
                      Connected • Last update: {formattedLastUpdate}
                      {autoRefresh && (
                        <span className="ml-2 text-xs">
                          • Next: {formatNextUpdate(nextUpdateIn)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <WifiOff className="h-3 w-3 mr-1 text-red-500" />{" "}
                      Disconnected
                    </span>
                  )}
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
