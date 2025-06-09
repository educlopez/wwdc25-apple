import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Fetch multiple Apple RSS feeds
    const feeds = [
      { url: "https://developer.apple.com/news/rss/news.rss", source: "Apple Developer" },
      { url: "https://www.apple.com/newsroom/rss-feed.rss", source: "Apple Newsroom" },
    ]

    const feedPromises = feeds.map(async (feed) => {
      try {
        const response = await fetch(feed.url, {
          headers: {
            "User-Agent": "WWDC25Tracker/1.0",
          },
        })
        const xmlText = await response.text()

        // Extract items using regex
        const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || []

        return items.map((item) => {
          // Extract title
          let title =
            item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || ""

          // Extract description and clean HTML thoroughly
          let description =
            item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
            item.match(/<description>(.*?)<\/description>/)?.[1] ||
            ""

          // Comprehensive HTML cleaning
          description = description
            // Remove all HTML tags completely
            .replace(/<[^>]*>/g, " ")
            // Remove HTML entities
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, " ")
            .replace(/&apos;/g, "'")
            .replace(/&copy;/g, "©")
            .replace(/&reg;/g, "®")
            .replace(/&trade;/g, "™")
            // Remove any remaining HTML-like content
            .replace(/&[a-zA-Z0-9#]+;/g, " ")
            // Clean up whitespace
            .replace(/\s+/g, " ")
            .trim()

          // If description is still mostly HTML or very short, try to extract meaningful content
          if (description.length < 50 || description.includes("class=") || description.includes("src=")) {
            // Try to extract text from content field if available
            const content = item.match(/<content:encoded><!\[CDATA\[(.*?)\]\]><\/content:encoded>/)?.[1] || ""
            if (content) {
              description = content
                .replace(/<[^>]*>/g, " ")
                .replace(/&[a-zA-Z0-9#]+;/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 300)
            } else {
              // Fallback to a generic description
              description = "Read more about this announcement from Apple."
            }
          }

          // Limit description length
          if (description.length > 300) {
            description = description.substring(0, 300) + "..."
          }

          // Extract link
          const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ""

          // Extract publication date
          const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ""

          // Clean title
          title = title
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, " ")
            .trim()

          return {
            title: title,
            description: description,
            url: link.trim(),
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            source: { name: feed.source },
          }
        })
      } catch (error) {
        console.error(`Error fetching RSS feed ${feed.url}:`, error)
        return []
      }
    })

    const allFeeds = await Promise.all(feedPromises)
    const allArticles = allFeeds.flat()

    // Sort by date (most recent first)
    allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    return NextResponse.json({
      articles: allArticles.slice(0, 30), // Limit to 30 most recent
    })
  } catch (error) {
    console.error("Apple RSS error:", error)
    return NextResponse.json({ error: "Failed to fetch Apple RSS data" }, { status: 500 })
  }
}
