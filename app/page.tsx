"use client"

import { useState, useEffect } from "react"
import { Apple, Wifi, WifiOff, ExternalLink, Clock, Calendar, Play, Pause, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

interface WWDCUpdate {
  id: string
  timestamp: string
  type: "news" | "official" | "live"
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
}

export default function WWDC25LiveTracker() {
  const [updates, setUpdates] = useState<WWDCUpdate[]>([])
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const { toast } = useToast()

  const fetchWWDC25Data = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      // Fetch live status first
      const liveStatusResponse = await fetch("/api/live-status")
      const liveStatusData = await liveStatusResponse.json()
      setLiveStatus(liveStatusData)

      // Fetch only news data
      const [newsData] = await Promise.allSettled([fetch("/api/news").then((res) => res.json())])

      const allUpdates: WWDCUpdate[] = []

      // Process News data with WWDC filtering
      if (newsData.status === "fulfilled" && newsData.value.articles) {
        const articles = newsData.value.articles
          .filter((article: any) => {
            const content = `${article.title} ${article.description || ""}`.toLowerCase()
            return (
              content.includes("wwdc") ||
              (content.includes("apple") && (content.includes("developer") || content.includes("keynote"))) ||
              content.includes("ios 19") ||
              content.includes("macos 15") ||
              content.includes("watchos 11") ||
              content.includes("tvos 18") ||
              content.includes("visionos 2") ||
              content.includes("xcode 16") ||
              content.includes("swift 6")
            )
          })
          .map((article: any) => ({
            id: article.url,
            timestamp: article.publishedAt,
            type: "news" as const,
            title: article.title,
            description: article.description || article.content?.substring(0, 200),
            author: article.author,
            url: article.url,
            source: article.source.name,
            isBreaking:
              article.title.toLowerCase().includes("breaking") ||
              article.title.toLowerCase().includes("live") ||
              new Date(article.publishedAt).getTime() > Date.now() - 3600000,
          }))
        allUpdates.push(...articles)
      }

      // Add live updates during keynote
      if (liveStatusData.isLive) {
        const liveUpdates: WWDCUpdate[] = [
          {
            id: `live-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: "live",
            title: "🔴 WWDC25 Keynote Live Now",
            description: "Apple's WWDC 2025 keynote is currently streaming live from Apple Park",
            source: "Apple Live Stream",
            isBreaking: true,
            url: "https://www.apple.com/apple-events/",
          },
        ]
        allUpdates.push(...liveUpdates)
      }

      // Sort by timestamp and breaking news priority
      allUpdates.sort((a, b) => {
        if (a.isBreaking && !b.isBreaking) return -1
        if (!a.isBreaking && b.isBreaking) return 1
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })

      setUpdates(allUpdates.slice(0, 100))
      setLastUpdate(new Date())
      setIsConnected(true)

      if (!isLoading && allUpdates.length > 0 && allUpdates[0].id !== updates[0]?.id) {
        toast({
          title: "New updates available",
          description: `${allUpdates.length} WWDC25 updates loaded`,
        })
      }
    } catch (error) {
      console.error("Failed to fetch WWDC25 data:", error)
      setIsConnected(false)

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
    fetchWWDC25Data()

    let interval: NodeJS.Timeout
    if (autoRefresh) {
      const refreshRate = liveStatus?.isLive ? 30000 : 120000
      interval = setInterval(fetchWWDC25Data, refreshRate)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, liveStatus?.isLive])

  const getTypeColor = (type: string, isBreaking?: boolean) => {
    if (isBreaking) return "bg-gradient-to-r from-red-500 to-pink-500"

    switch (type) {
      case "live":
        return "bg-gradient-to-r from-red-500 to-pink-500"
      case "news":
        return "bg-gradient-to-r from-green-500 to-emerald-500"
      case "official":
        return "bg-gradient-to-r from-purple-500 to-violet-500"
      default:
        return "bg-gradient-to-r from-gray-500 to-slate-500"
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
      return "🔴 KEYNOTE LIVE NOW"
    }

    if (liveStatus.keynoteStartsIn > 0) {
      return `⏰ Keynote starts in ${liveStatus.keynoteStartsIn} hours (7:00 PM Spain)`
    }

    return "✅ Keynote completed"
  }

  const filteredUpdates = updates.filter((update) => {
    if (activeTab === "all") return true
    if (activeTab === "breaking") return update.isBreaking
    return update.type === activeTab
  })

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
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    variant="outline"
                    size="sm"
                    className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border-white/20 dark:border-gray-700/20 hover:bg-white/30 dark:hover:bg-gray-800/30"
                  >
                    {autoRefresh ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    <span className="hidden md:inline ml-1">{autoRefresh ? "Pause" : "Resume"}</span>
                  </Button>
                  <Button
                    onClick={fetchWWDC25Data}
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
          {/* Keynote Status Alert */}
          {liveStatus && (
            <Alert
              className={`mb-6 bg-white/30 dark:bg-gray-900/30 backdrop-blur-xl border-white/20 dark:border-gray-700/20 ${
                liveStatus.isLive
                  ? "border-red-400/50 bg-red-50/30 dark:bg-red-950/30"
                  : "border-blue-400/50 bg-blue-50/30 dark:bg-blue-950/30"
              }`}
            >
              <Clock className={`h-4 w-4 ${liveStatus.isLive ? "text-red-500" : "text-blue-500"}`} />
              <AlertDescription className="text-lg font-medium text-gray-800 dark:text-white">
                {getCountdownToKeynote()}
              </AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            {[
              { title: "Total Updates", value: updates.length, desc: "News articles" },
              {
                title: "Breaking News",
                value: updates.filter((u) => u.isBreaking).length,
                desc: "Recent announcements",
              },
              {
                title: "Last Updated",
                value: lastUpdate.toLocaleTimeString("en-US"),
                desc: liveStatus?.isLive ? "Every 30s" : "Every 2min",
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
                  className={`w-3 h-3 rounded-full ${liveStatus?.isLive ? "bg-red-500 animate-pulse" : "bg-green-500"}`}
                ></div>
                <span>Live WWDC25 Feed</span>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Real-time updates from Apple's Worldwide Developers Conference 2025
              </CardDescription>

              <Tabs defaultValue="all" className="mt-2" onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 md:w-[300px] bg-white/20 dark:bg-gray-800/20 backdrop-blur-xl border-white/20 dark:border-gray-700/20">
                  <TabsTrigger
                    value="all"
                    className="data-[state=active]:bg-white/40 dark:data-[state=active]:bg-gray-700/40"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="breaking"
                    className="data-[state=active]:bg-white/40 dark:data-[state=active]:bg-gray-700/40"
                  >
                    Breaking
                  </TabsTrigger>
                  <TabsTrigger
                    value="news"
                    className="data-[state=active]:bg-white/40 dark:data-[state=active]:bg-gray-700/40"
                  >
                    News
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
                  {filteredUpdates.length > 0 ? (
                    filteredUpdates.map((update, index) => (
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
                                {update.type === "live" ? "LIVE" : update.type === "news" ? "NEWS" : "OFFICIAL"}
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
                              <a href={update.url} target="_blank" rel="noopener noreferrer">
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
                      <p>No {activeTab === "all" ? "WWDC25" : activeTab} updates at the moment</p>
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
                >
                  <Apple className="h-4 w-4" />
                  <span>Official WWDC25 Event</span>
                </a>
                <a
                  href="https://x.com/educalvolpz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Follow @educalvolpz</span>
                </a>
              </div>
              <div className="text-center">
                <p className="font-medium">WWDC25 Live Tracker • Real-time updates</p>
                <p className="mt-1 text-xs">June 9-13, 2025 • A week of technology and creativity</p>
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
