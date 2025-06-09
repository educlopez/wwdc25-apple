import { NextResponse } from "next/server"

export async function GET() {
  try {
    const apiKey = process.env.NEWS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "News API key not configured" }, { status: 500 })
    }

    // WWDC-specific search terms only
    const wwdcQuery = [
      '"WWDC 2025"',
      '"WWDC25"',
      '"Apple WWDC 2025"',
      '"Worldwide Developers Conference 2025"',
      '"Apple keynote 2025"',
      '"Apple developer conference"',
      '"iOS 26"',
      '"macOS 16"',
      '"watchOS 12"',
      '"tvOS 19"',
      '"visionOS 3"',
      '"Xcode 17"',
      '"Swift 7"',
      '"Apple Intelligence 2"',
      '"Craig Federighi" AND WWDC',
      '"Tim Cook" AND keynote',
      '"Apple Park" AND developer',
    ].join(" OR ")

    const response = await fetch(
      `https://newsapi.org/v2/everything?` +
        new URLSearchParams({
          q: wwdcQuery,
          sources:
            "techcrunch,the-verge,ars-technica,wired,engadget,9to5mac,macrumors,appleinsider,reuters,associated-press,bbc-news,bloomberg",
          sortBy: "publishedAt",
          language: "en",
          pageSize: "50",
          from: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        }),
      {
        headers: {
          "X-API-Key": apiKey,
        },
      },
    )

    const data = await response.json()

    // Enhanced filtering for WWDC-specific content only
    if (data.articles) {
      data.articles = data.articles.filter((article: any) => {
        const content = `${article.title} ${article.description || ""}`.toLowerCase()
        const wwdcKeywords = [
          "wwdc",
          "worldwide developers conference",
          "apple developer conference",
          "apple keynote",
          "ios 26",
          "macos 16",
          "watchos 12",
          "tvos 19",
          "visionos 3",
          "xcode 17",
          "swift 7",
          "craig federighi",
          "developer beta",
          "apple park",
        ]

        return wwdcKeywords.some((keyword) => content.includes(keyword))
      })

      // Sort by WWDC relevance and recency
      data.articles.sort((a: any, b: any) => {
        const aContent = `${a.title} ${a.description || ""}`.toLowerCase()
        const bContent = `${b.title} ${b.description || ""}`.toLowerCase()

        // Prioritize articles with WWDC in title
        const aHasWWDC = aContent.includes("wwdc")
        const bHasWWDC = bContent.includes("wwdc")

        if (aHasWWDC && !bHasWWDC) return -1
        if (!aHasWWDC && bHasWWDC) return 1

        // Then sort by date
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("WWDC News API error:", error)
    return NextResponse.json({ error: "Failed to fetch WWDC news data" }, { status: 500 })
  }
}
