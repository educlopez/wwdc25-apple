import { NextResponse } from "next/server"

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "News API key not configured" }, { status: 500 })
    }

    // Very specific WWDC25 search terms
    const wwdcQuery = [
      '"WWDC 2025"',
      '"WWDC25"',
      '"Apple WWDC 2025"',
      '"iOS 19"',
      '"macOS 15"',
      '"watchOS 11"',
      '"tvOS 18"',
      '"visionOS 2"',
      '"Xcode 16"',
      '"Swift 6"',
      '"Apple Intelligence"',
      "Apple AND (keynote OR developer OR conference) AND 2025",
    ].join(" OR ")

    const response = await fetch(
      `https://newsapi.org/v2/everything?` +
        new URLSearchParams({
          q: wwdcQuery,
          sources: "techcrunch,the-verge,ars-technica,wired,engadget,9to5mac,macrumors,appleinsider",
          sortBy: "publishedAt",
          language: "en",
          pageSize: "100",
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Last 7 days
        }),
      {
        headers: {
          "X-API-Key": apiKey,
        },
      },
    )

    const data = await response.json()

    // Filter articles to only include WWDC-related content
    if (data.articles) {
      data.articles = data.articles.filter((article: any) => {
        const content = `${article.title} ${article.description} ${article.content || ""}`.toLowerCase()
        const wwdcKeywords = [
          "wwdc",
          "worldwide developers conference",
          "apple developer",
          "keynote",
          "ios 19",
          "macos 15",
          "watchos 11",
          "tvos 18",
          "visionos 2",
          "xcode 16",
          "swift 6",
          "apple intelligence",
          "craig federighi",
          "tim cook",
          "apple park",
          "cupertino",
        ]

        return wwdcKeywords.some((keyword) => content.includes(keyword))
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("News API error:", error)
    return NextResponse.json({ error: "Failed to fetch news data" }, { status: 500 })
  }
}
