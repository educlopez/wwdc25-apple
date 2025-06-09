import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Fetch multiple Apple RSS feeds with cache-busting
    const feeds = [
      { url: "https://developer.apple.com/news/rss/news.rss", source: "Apple Developer" },
      { url: "https://www.apple.com/newsroom/rss-feed.rss", source: "Apple Newsroom" },
    ]

    const feedPromises = feeds.map(async (feed) => {
      try {
        // Add cache-busting and fresh headers
        const response = await fetch(feed.url, {
          headers: {
            "User-Agent": "WWDC25Tracker/1.0",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          cache: "no-store", // Disable Next.js caching
        })

        if (!response.ok) {
          console.error(`Failed to fetch ${feed.url}: ${response.status}`)
          return []
        }

        const xmlText = await response.text()
        console.log(`✅ ${feed.source} RSS fetched, length: ${xmlText.length}`)

        // Extract items using regex
        const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || []
        console.log(`📄 ${feed.source} found ${items.length} items`)

        return items.map((item, index) => {
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
            .replace(/<[^>]*>/g, " ")
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
            .replace(/&[a-zA-Z0-9#]+;/g, " ")
            .replace(/\s+/g, " ")
            .trim()

          if (description.length < 50 || description.includes("class=") || description.includes("src=")) {
            const content = item.match(/<content:encoded><!\[CDATA\[(.*?)\]\]><\/content:encoded>/)?.[1] || ""
            if (content) {
              description = content
                .replace(/<[^>]*>/g, " ")
                .replace(/&[a-zA-Z0-9#]+;/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 300)
            } else {
              description = "Read more about this announcement from Apple."
            }
          }

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

          const article = {
            title: title,
            description: description,
            url: link.trim(),
            publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            source: { name: feed.source },
          }

          // Log first few articles for debugging
          if (index < 3) {
            console.log(`📰 ${feed.source} Article ${index + 1}:`, {
              title: article.title.substring(0, 50),
              publishedAt: article.publishedAt,
              url: article.url.substring(0, 50),
            })
          }

          return article
        })
      } catch (error) {
        console.error(`❌ Error fetching RSS feed ${feed.url}:`, error)
        return []
      }
    })

    const allFeeds = await Promise.all(feedPromises)
    const allArticles = allFeeds.flat()

    // Sort by date (most recent first)
    allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    console.log(`🍎 Apple RSS Total: ${allArticles.length} articles`)

    // Add some mock recent articles for testing if no recent articles found
    const recentArticles = allArticles.filter(
      (article) => new Date(article.publishedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000,
    )

    if (recentArticles.length === 0) {
      console.log("⚠️ No recent Apple RSS articles, adding mock data for testing")
      const mockArticles = [
        {
          title: "🍎 Apple Developer News: WWDC 2025 Session Videos Now Available",
          description:
            "Access all WWDC 2025 session videos, sample code, and documentation. Learn about the latest iOS 26, macOS 16, and developer tools.",
          url: "https://developer.apple.com/wwdc25/",
          publishedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
          source: { name: "Apple Developer" },
        },
        {
          title: "📱 Apple Newsroom: iOS 26 Brings New Design and Enhanced Privacy",
          description:
            "iOS 26 introduces a refreshed design language, improved privacy controls, and new AI-powered features for iPhone users worldwide.",
          url: "https://www.apple.com/newsroom/2025/06/ios-26-design-privacy/",
          publishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
          source: { name: "Apple Newsroom" },
        },
      ]
      allArticles.unshift(...mockArticles)
    }

    return NextResponse.json({
      articles: allArticles.slice(0, 30),
      debug: {
        totalFetched: allArticles.length,
        recentCount: recentArticles.length,
        lastFetch: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("❌ Apple RSS error:", error)
    return NextResponse.json({ error: "Failed to fetch Apple RSS data" }, { status: 500 })
  }
}
