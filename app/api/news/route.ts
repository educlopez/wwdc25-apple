import { NextResponse } from "next/server"

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "News API key not configured" }, { status: 500 })
    }

    // More aggressive real-time search during live events
    const liveNewsQuery = [
      "WWDC 2025",
      "WWDC25",
      "Apple WWDC",
      "Apple keynote",
      "iOS 19",
      "iOS 26",
      "Apple announces",
      "Apple unveils",
      "Apple reveals",
      "new iPhone",
      "new iPad",
      "new Mac",
      "new design",
      "Apple Intelligence",
      "Siri update",
      "macOS 15",
      "macOS 16",
      "watchOS 12",
      "tvOS 19",
      "visionOS 3",
      "Xcode 17",
      "Swift 7",
      "App Store",
      "Craig Federighi",
      "Tim Cook keynote",
      "Apple developer",
      "Apple beta",
    ].join(" OR ")

    console.log("Live News API Query:", liveNewsQuery)

    const response = await fetch(
      `https://newsapi.org/v2/everything?` +
        new URLSearchParams({
          q: liveNewsQuery,
          sources:
            "techcrunch,the-verge,ars-technica,wired,engadget,9to5mac,macrumors,appleinsider,reuters,associated-press,bbc-news,bloomberg,cnn,abc-news",
          sortBy: "publishedAt",
          language: "en",
          pageSize: "100", // Get more articles
          from: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Last 2 hours for live coverage
        }),
      {
        headers: {
          "X-API-Key": apiKey,
          "User-Agent": "WWDC25Tracker/1.0",
        },
      },
    )

    console.log("News API Response Status:", response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("NewsAPI Error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      })

      if (response.status === 429) {
        return NextResponse.json({ error: "NewsAPI rate limit exceeded" }, { status: 429 })
      }
      if (response.status === 401) {
        return NextResponse.json({ error: "NewsAPI key invalid or missing" }, { status: 401 })
      }

      return NextResponse.json(
        { error: `NewsAPI error: ${response.status} ${response.statusText}` },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("News API Raw Results:", data.totalResults || 0, "articles")

    // Much more lenient filtering for live coverage
    if (data.articles) {
      const originalCount = data.articles.length

      data.articles = data.articles.filter((article: any) => {
        const content = `${article.title} ${article.description || ""}`.toLowerCase()

        // Very broad Apple/tech keywords for live coverage
        const liveKeywords = [
          "apple",
          "wwdc",
          "ios",
          "iphone",
          "ipad",
          "mac",
          "macos",
          "keynote",
          "announces",
          "unveils",
          "reveals",
          "new",
          "design",
          "update",
          "feature",
          "developer",
          "tim cook",
          "craig federighi",
          "cupertino",
          "app store",
          "siri",
          "intelligence",
          "beta",
          "release",
          "software",
          "hardware",
          "watch",
          "tv",
          "vision",
          "xcode",
          "swift",
        ]

        const hasKeyword = liveKeywords.some((keyword) => content.includes(keyword))

        // During live events, be even more lenient
        const hasApple = content.includes("apple")
        const hasWWDC = content.includes("wwdc") || content.includes("developer")
        const hasKeynote = content.includes("keynote") || content.includes("announces")

        return hasKeyword || hasApple || hasWWDC || hasKeynote
      })

      console.log(`Filtered from ${originalCount} to ${data.articles.length} articles`)

      // Prioritize very recent articles and live coverage
      data.articles.sort((a: any, b: any) => {
        const aContent = `${a.title} ${a.description || ""}`.toLowerCase()
        const bContent = `${b.title} ${b.description || ""}`.toLowerCase()

        // Prioritize articles with live/breaking keywords
        const aIsLive =
          aContent.includes("live") ||
          aContent.includes("breaking") ||
          aContent.includes("announces") ||
          aContent.includes("unveils")
        const bIsLive =
          bContent.includes("live") ||
          bContent.includes("breaking") ||
          bContent.includes("announces") ||
          bContent.includes("unveils")

        if (aIsLive && !bIsLive) return -1
        if (!aIsLive && bIsLive) return 1

        // Then prioritize WWDC-specific content
        const aHasWWDC = aContent.includes("wwdc") || aContent.includes("keynote")
        const bHasWWDC = bContent.includes("wwdc") || bContent.includes("keynote")

        if (aHasWWDC && !bHasWWDC) return -1
        if (!aHasWWDC && bHasWWDC) return 1

        // Finally sort by date (most recent first)
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      })

      // Log first few articles for debugging
      console.log(
        "Top 5 articles:",
        data.articles.slice(0, 5).map((a: any) => ({
          title: a.title,
          source: a.source.name,
          publishedAt: a.publishedAt,
          isRecent: new Date(a.publishedAt).getTime() > Date.now() - 60 * 60 * 1000, // Last hour
        })),
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("News API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch news data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
