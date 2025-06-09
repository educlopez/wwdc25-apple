import { NextResponse } from "next/server"

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "News API key not configured" }, { status: 500 })
    }

    // More NewsAPI-optimized search query
    const newsQuery = "WWDC 2025 OR WWDC25 OR Apple WWDC OR iOS 19 OR iOS 26 OR Apple keynote"

    console.log("News API Query:", newsQuery)

    const response = await fetch(
      `https://newsapi.org/v2/everything?` +
        new URLSearchParams({
          q: newsQuery,
          sources: "techcrunch,the-verge,ars-technica,wired,engadget,9to5mac,macrumors,appleinsider",
          sortBy: "publishedAt",
          language: "en",
          pageSize: "50",
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Last 7 days
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

      // Handle specific NewsAPI error codes
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

    console.log("NewsAPI Response:", {
      status: data.status,
      totalResults: data.totalResults,
      articlesCount: data.articles?.length || 0,
    })

    // More lenient filtering to ensure we get results
    if (data.articles) {
      const originalCount = data.articles.length

      data.articles = data.articles.filter((article: any) => {
        const content = `${article.title} ${article.description || ""}`.toLowerCase()

        // Very broad Apple-related keywords
        const keywords = [
          "apple",
          "wwdc",
          "ios",
          "macos",
          "iphone",
          "ipad",
          "mac",
          "tim cook",
          "craig federighi",
          "cupertino",
          "keynote",
          "developer",
          "xcode",
          "swift",
          "app store",
        ]

        const hasKeyword = keywords.some((keyword) => content.includes(keyword))

        // Log filtered articles for debugging
        if (!hasKeyword) {
          console.log("Filtered out:", article.title)
        }

        return hasKeyword
      })

      console.log(`Filtered from ${originalCount} to ${data.articles.length} articles`)

      // Simple sort by date
      data.articles.sort((a: any, b: any) => {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      })

      // Log first few articles for debugging
      console.log(
        "First 3 articles:",
        data.articles.slice(0, 3).map((a: any) => ({
          title: a.title,
          source: a.source.name,
          publishedAt: a.publishedAt,
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
