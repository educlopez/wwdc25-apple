"use client"

import { useState, useEffect } from "react"
import { Apple, Wifi, WifiOff, ExternalLink, Clock, Calendar, Play, Pause, RefreshCw, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { track } from "@vercel/analytics"

interface WWDCUpdate {
  id: string
  timestamp: string
  type: "news" | "apple-official" | "live"
  title: string
  description: string
  author?: string
  url?: string
  source: string
  isBreaking?: boolean
}

interface LiveStatus {
  isLive: boolean
  spainTime: string
  pacificTime: string
  keynoteStartsIn: number
  currentHour: number
  keynoteHour: number
  keynoteEndHour: number
  isWWDCWeek: boolean
  currentDate: string
  minutesUntilKeynote: number
  minutesUntilEnd: number
}

export default function WWDC25LiveTracker() {
  const [newsUpdates, setNewsUpdates] = useState<WWDCUpdate[]>([])
  const [appleUpdates, setAppleUpdates] = useState<WWDCUpdate[]>([])
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [activeTab, setActiveTab] = useState("news")
  const [apiErrors, setApiErrors] = useState<string[]>([])
  const { toast } = useToast()

  // Helper function to check if article is breaking (today or last hour)
  const isBreakingNews = (publishedAt: string, title: string) => {
    const articleTime = new Date(publishedAt)
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Breaking if:
    // 1. Published in the last hour, OR
    // 2. Published today AND contains urgent keywords
    const isLastHour = articleTime >= oneHourAgo
    const isToday = articleTime >= todayStart
    const hasUrgentKeywords =
      title.toLowerCase().includes("breaking") ||
      title.toLowerCase().includes("live") ||
      title.toLowerCase().includes("just announced")

    return isLastHour || (isToday && hasUrgentKeywords)
  }

  const fetchWWDC25Data = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    setApiErrors([])

    try {
      // Track data fetch events
      track("data_fetch", {
        timestamp: new Date().toISOString(),
        is_live: liveStatus?.isLive || false,
      })

      // Fetch live status first
      const liveStatusResponse = await fetch("/api/live-status")
      const liveStatusData = await liveStatusResponse.json()
      setLiveStatus(liveStatusData)

      // Fetch from data sources
      const [newsData, appleRssData] = await Promise.allSettled([
        fetch("/api/news").then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json()
            throw new Error(`News API: ${errorData.error || res.statusText}`)
          }
          return res.json()
        }),
        fetch("/api/apple-rss").then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json()
            throw new Error(`Apple RSS: ${errorData.error || res.statusText}`)
          }
          return res.json()
        }),
      ])

      const newsAllUpdates: WWDCUpdate[] = []
      const appleAllUpdates: WWDCUpdate[] = []
      const errors: string[] = []

      // Process News API data
      if (newsData.status === "fulfilled" && newsData.value.articles) {
        console.log("News API returned", newsData.value.articles.length, "articles")
        const articles = newsData.value.articles.map((article: any) => ({
          id: `news-${article.url}`,
          timestamp: article.publishedAt,
          type: "news" as const,
          title: article.title,
          description: article.description || article.content?.substring(0, 200) || "Read more...",
          author: article.author,
          url: article.url,
          source: article.source.name,
          isBreaking: isBreakingNews(article.publishedAt, article.title),
        }))
        newsAllUpdates.push(...articles)
      } else if (newsData.status === "rejected") {
        errors.push(`News API: ${newsData.reason.message}`)
        console.error("News API failed:", newsData.reason)
      }

      // Process Apple Official RSS data
      if (appleRssData.status === "fulfilled" && appleRssData.value.articles) {
        console.log("Apple RSS returned", appleRssData.value.articles.length, "articles")
        const rssArticles = appleRssData.value.articles.map((article: any) => ({
          id: `apple-${article.url}`,
          timestamp: article.publishedAt,
          type: "apple-official" as const,
          title: article.title,
          description: article.description,
          url: article.url,
          source: article.source.name,
          isBreaking: isBreakingNews(article.publishedAt, article.title),
        }))
        appleAllUpdates.push(...rssArticles)
      } else if (appleRssData.status === "rejected") {
        errors.push(`Apple RSS: ${appleRssData.reason.message}`)
        console.error("Apple RSS failed:", appleRssData.reason)
      }

      // Add live updates when ACTUALLY live
      if (liveStatusData.isLive) {
        const timeRemaining = liveStatusData.minutesUntilEnd
        const liveUpdates: WWDCUpdate[] = [
          {
            id: `live-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "live",
            title: "🔴 WWDC25 Keynote Live Now",
            description: `Apple's WWDC 2025 keynote is streaming live from Apple Park${
              timeRemaining > 0 ? ` • ${Math.floor(timeRemaining / 60)}h ${timeRemaining % 60}m remaining` : ""
            }`,
            source: "Apple Live Stream",
            isBreaking: true,
            url: "https://www.apple.com/apple-events/",
          },
        ]
        newsAllUpdates.push(...liveUpdates)

        // Track when keynote goes live
        track("keynote_live", {
          timestamp: new Date().toISOString(),
          minutes_remaining: timeRemaining,
        })
      }

      // Sort both arrays by timestamp and breaking news priority
      const sortUpdates = (updates: WWDCUpdate[]) => {
        return updates.sort((a, b) => {
          if (a.isBreaking && !b.isBreaking) return -1
          if (!a.isBreaking && b.isBreaking) return 1
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        })
      }

      setNewsUpdates(sortUpdates(newsAllUpdates).slice(0, 100))
      setAppleUpdates(sortUpdates(appleAllUpdates).slice(0, 50))
      setLastUpdate(new Date())
      setIsConnected(true)
      setApiErrors(errors)

      const totalUpdates = newsAllUpdates.length + appleAllUpdates.length

      console.log(`Total updates: ${totalUpdates} (News: ${newsAllUpdates.length}, Apple: ${appleAllUpdates.length})`)

      if (!isLoading && totalUpdates > 0) {
        toast({
          title: "New updates available",
          description: `${newsAllUpdates.length} news updates, ${appleAllUpdates.length} Apple official updates`,
        })

        // Track new updates
        track("new_updates", {
          news_count: newsAllUpdates.length,
          apple_count: appleAllUpdates.length,
          breaking_count: [...newsAllUpdates, ...appleAllUpdates].filter((u) => u.isBreaking).length,
        })
      }

      if (errors.length > 0) {
        toast({
          title: "Some APIs failed",
          description: `${errors.length} API(s) had errors. Check console for details.`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to fetch WWDC25 data:", error)
      setIsConnected(false)

      // Track errors
      track("fetch_error", {
        error: error instanceof Error ? error.message : "Unknown error",
      })

      toast({
        title: "Connection error",
        description: "Could not load updates. Retrying...",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    // Track page load
    track("page_load", {
      timestamp: new Date().toISOString(),
    })

    fetchWWDC25Data()

    let interval: NodeJS.Timeout
    if (autoRefresh) {
      // More frequent updates during live stream
      const refreshRate = liveStatus?.isLive
        ? 15000 // Every 15 seconds when live
        : liveStatus?.minutesUntilKeynote && liveStatus.minutesUntilKeynote < 30
          ? 30000 // Every 30 seconds when starting soon
          : 120000 // Every 2 minutes normally
      interval = setInterval(fetchWWDC25Data, refreshRate)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, liveStatus?.isLive, liveStatus?.minutesUntilKeynote])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    track("tab_change", { tab: value })
  }

  const handleAutoRefreshToggle = () => {
    const newValue = !autoRefresh
    setAutoRefresh(newValue)
    track("auto_refresh_toggle", { enabled: newValue })
  }

  const handleManualRefresh = () => {
    track("manual_refresh")
    fetchWWDC25Data()
  }

  const handleAppleEventClick = () => {
    track("apple_event_click", {
      timestamp: new Date().toISOString(),
      is_live: liveStatus?.isLive || false,
    })
  }

  const handleTwitterClick = () => {
    track("twitter_click", {
      timestamp: new Date().toISOString(),
    })
  }

  const handleNewsClick = (update: WWDCUpdate) => {
    track("news_click", {
      source: update.source,
      type: update.type,
      is_breaking: update.isBreaking || false,
      timestamp: new Date().toISOString(),
    })
  }

  const getTypeColor = (type: string, isBreaking?: boolean) => {
    if (isBreaking) return "bg-gradient-to-r from-red-500 to-pink-500"

    switch (type) {
      case "live":
        return "bg-gradient-to-r from-red-500 to-pink-500"
      case "news":
        return "bg-gradient-to-r from-green-500 to-emerald-500"
      case "apple-official":
        return "bg-gradient-to-r from-purple-500 to-violet-500"
      default:
        return "bg-gradient-to-r from-gray-500 to-slate-500"
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case "live":
        return "LIVE"
      case "news":
        return "NEWS"
      case "apple-official":
        return "APPLE"
      default:
        return "UPDATE"
    }
  }

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const getCountdownToKeynote = () => {
    if (!liveStatus) return null

    if (liveStatus.isLive) {
      const timeRemaining = liveStatus.minutesUntilEnd
      if (timeRemaining > 0) {
        const hours = Math.floor(timeRemaining / 60)
        const minutes = timeRemaining % 60
        return `🔴 KEYNOTE LIVE • ${hours}h ${minutes}m remaining (until 21:00)`
      }
      return "🔴 KEYNOTE LIVE NOW"
    }

    if (!liveStatus.isWWDCWeek) {
      return "📅 WWDC25: June 9-13, 2025"
    }

    if (liveStatus.minutesUntilKeynote && liveStatus.minutesUntilKeynote > 0 && liveStatus.minutesUntilKeynote < 60) {
      return `⏰ Keynote starts in ${liveStatus.minutesUntilKeynote} minutes!`
    }

    if (liveStatus.keynoteStartsIn > 0) {
      return `⏰ Keynote starts in ${liveStatus.keynoteStartsIn} hours (19:00-21:00 Spain)`
    }

    return "✅ Today's keynote completed (19:00-21:00)"
  }

  const getCurrentUpdates = () => {
    switch (activeTab) {
      case "news":
        return newsUpdates
      case "apple":
        return appleUpdates
      case "breaking":
        return [...newsUpdates, ...appleUpdates].filter((u) => u.isBreaking)
      default:
        return newsUpdates
    }
  }

  const currentUpdates = getCurrentUpdates()

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* WWDC25 Background with Glassmorphism */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-100 via-white to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Floating Color Orbs */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-blue-400/30 to-cyan-400/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-32 w-80 h-80 bg-gradient-to-r from-purple-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-1/3 w-72 h-72 bg-gradient-to-r from-green-400/30 to-emerald-400/30 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-20 w-64 h-64 bg-gradient-to-r from-yellow-400/30 to-orange-400/30 rounded-full blur-3xl animate-pulse delay-3000"></div>

        {/* Glass overlay */}
        <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white/20 dark:bg-gray-900/20 backdrop-blur-xl border-b border-white/20 dark:border-gray-700/20 sticky top-0 z-50">
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
                    ) : liveStatus?.minutesUntilKeynote && liveStatus.minutesUntilKeynote < 30 ? (
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
                      <span>Watch Live</span>
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
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      <span className="hidden md:inline">@educalvolpz</span>
                    </a>
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                  <Button
                    onClick={handleAutoRefreshToggle}
                    variant="outline"
                    size="sm"
                    className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border-white/20 dark:border-gray-700/20 hover:bg-white/30 dark:hover:bg-gray-800/30"
                  >
                    {autoRefresh ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    <span className="hidden md:inline ml-1">{autoRefresh ? "Pause" : "Resume"}</span>
                  </Button>
                  <Button
                    onClick={handleManualRefresh}
                    variant="outline"
                    size="sm"
                    disabled={isRefreshing}
                    className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border-white/20 dark:border-gray-700/20 hover:bg-white/30 dark:hover:bg-gray-800/30"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
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
            <Alert className="mb-6 bg-yellow-50/30 dark:bg-yellow-950/30 backdrop-blur-xl border-yellow-400/50">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-gray-800 dark:text-white">
                <strong>API Issues:</strong> {apiErrors.join(", ")}
              </AlertDescription>
            </Alert>
          )}

          {/* Keynote Status Alert */}
          {liveStatus && (
            <Alert
              className={`mb-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl border-white/20 dark:border-gray-700/20 ${
                liveStatus.isLive
                  ? "border-red-400/50 bg-red-50/30 dark:bg-red-950/30"
                  : liveStatus.minutesUntilKeynote && liveStatus.minutesUntilKeynote < 30
                    ? "border-orange-400/50 bg-orange-50/30 dark:bg-orange-950/30"
                    : "border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/30"
              }`}
            >
              <Clock
                className={`h-4 w-4 ${
                  liveStatus.isLive
                    ? "text-red-500"
                    : liveStatus.minutesUntilKeynote && liveStatus.minutesUntilKeynote < 30
                      ? "text-orange-500"
                      : "text-blue-500"
                }`}
              />
              <AlertDescription className="text-lg font-medium text-gray-800 dark:text-white">
                {getCountdownToKeynote()}
              </AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
            {[
              { title: "News Updates", value: newsUpdates.length, desc: "Latest news" },
              { title: "Apple Official", value: appleUpdates.length, desc: "Official notices" },
              {
                title: "Breaking News",
                value: [...newsUpdates, ...appleUpdates].filter((u) => u.isBreaking).length,
                desc: "Today/Last hour",
              },
              {
                title: "Last Updated",
                value: lastUpdate.toLocaleTimeString("en-US"),
                desc: liveStatus?.isLive
                  ? "Every 15s"
                  : liveStatus?.minutesUntilKeynote && liveStatus.minutesUntilKeynote < 30
                    ? "Every 30s"
                    : "Every 2min",
              },
            ].map((stat, index) => (
              <Card
                key={index}
                className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl border-white/20 dark:border-gray-700/20 hover:bg-white/40 dark:hover:bg-gray-900/40 transition-all duration-300"
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">{stat.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16 bg-white/20" />
                  ) : (
                    <div className="text-2xl font-bold text-gray-800 dark:text-white">{stat.value}</div>
                  )}
                  <p className="text-xs text-gray-600 dark:text-gray-400">{stat.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Live WWDC25 Feed */}
          <Card className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl border-white/20 dark:border-gray-700/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-gray-800 dark:text-white">
                <div
                  className={`w-3 h-3 rounded-full ${
                    liveStatus?.isLive
                      ? "bg-red-500 animate-pulse"
                      : liveStatus?.minutesUntilKeynote && liveStatus.minutesUntilKeynote < 30
                        ? "bg-orange-500 animate-pulse"
                        : "bg-green-500"
                  }`}
                ></div>
                <span>Live WWDC25 Feed</span>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Real-time updates from Apple's Worldwide Developers Conference 2025 • Keynote: 19:00-21:00 Spain • iOS
                19/26 • macOS 15/16
              </CardDescription>

              <Tabs defaultValue="news" className="mt-2" onValueChange={handleTabChange}>
                <TabsList className="grid grid-cols-3 md:w-[400px] bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border-white/20 dark:border-gray-700/20">
                  <TabsTrigger
                    value="news"
                    className="data-[state=active]:bg-white/40 dark:data-[state=active]:bg-gray-700/40"
                  >
                    News & Updates
                  </TabsTrigger>
                  <TabsTrigger
                    value="apple"
                    className="data-[state=active]:bg-white/40 dark:data-[state=active]:bg-gray-700/40"
                  >
                    Apple Official
                  </TabsTrigger>
                  <TabsTrigger
                    value="breaking"
                    className="data-[state=active]:bg-white/40 dark:data-[state=active]:bg-gray-700/40"
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
                        className={`bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl rounded-lg p-4 border border-white/10 dark:border-gray-700/10 transition-all duration-300 hover:bg-white/30 dark:hover:bg-gray-800/30 hover:shadow-lg ${
                          update.isBreaking ? "border-red-400/50 bg-red-50/20 dark:bg-red-950/20" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge
                                className={`${getTypeColor(update.type, update.isBreaking)} text-white border-0 ${
                                  update.isBreaking || update.type === "live" ? "animate-pulse" : ""
                                }`}
                              >
                                {getTypeName(update.type)}
                              </Badge>
                              {update.isBreaking && (
                                <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white animate-pulse border-0">
                                  BREAKING
                                </Badge>
                              )}
                              <span className="text-sm text-gray-600 dark:text-gray-400">{update.source}</span>
                              <span className="text-sm text-gray-500 dark:text-gray-500 ml-auto">
                                {formatRelativeTime(update.timestamp)}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-800 dark:text-white mb-1">{update.title}</h3>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">{update.description}</p>
                            {update.author && (
                              <p className="text-xs text-gray-500 dark:text-gray-500">by {update.author}</p>
                            )}
                          </div>
                          {update.url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              className="ml-2 shrink-0 hover:bg-white/20 dark:hover:bg-gray-700/20"
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
                      <p>No {activeTab === "news" ? "news" : activeTab} updates at the moment</p>
                      <p className="text-sm">Updates will appear here when available</p>
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
                  href="https://x.com/educalvolpz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  onClick={handleTwitterClick}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Follow @educalvolpz</span>
                </a>
              </div>
              <div className="text-center">
                <p className="font-medium">WWDC25 Live Tracker • Real-time updates</p>
                <p className="mt-1 text-xs">
                  June 9-13, 2025 • Keynote: 19:00-21:00 Spain • iOS 19/26 • macOS 15/16 • watchOS 11/12
                </p>
                <p className="mt-2">
                  {isConnected ? (
                    <span className="flex items-center justify-center">
                      <Wifi className="h-3 w-3 mr-1 text-green-500" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <WifiOff className="h-3 w-3 mr-1 text-red-500" /> Disconnected
                    </span>
                  )}
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
