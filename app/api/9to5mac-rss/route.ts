import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch("https://9to5mac.com/feed/", {
      headers: {
        "User-Agent": "WWDC25Tracker/1.0",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch 9to5Mac RSS: ${response.status}`)
    }

    const xmlText = await response.text()

    // Extract items using regex (more reliable than XML parsing in this environment)
    const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || []

    const articles = items.map((item) => {
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
          description = "Read the latest Apple news and WWDC updates from 9to5Mac."
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

      // Extract author/creator
      const creator =
        item.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/)?.[1] ||
        item.match(/<dc:creator>(.*?)<\/dc:creator>/)?.[1] ||
        item.match(/<author>(.*?)<\/author>/)?.[1] ||
        ""

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
        author: creator.trim() || undefined,
        source: { name: "9to5Mac" },
      }
    })

    // Filter for Apple/WWDC related content
    const filteredArticles = articles.filter((article) => {
      const content = `${article.title} ${article.description}`.toLowerCase()
      const appleKeywords = [
        "apple",
        "ios",
        "ipad",
        "iphone",
        "mac",
        "macos",
        "wwdc",
        "keynote",
        "tim cook",
        "craig federighi",
        "app store",
        "siri",
        "watch",
        "airpods",
        "vision",
        "visionos",
        "tvos",
        "watchos",
        "xcode",
        "swift",
        "developer",
        "cupertino",
        "apple park",
      ]

      return appleKeywords.some((keyword) => content.includes(keyword))
    })

    // Sort by date (most recent first)
    filteredArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    console.log(`9to5Mac RSS: ${filteredArticles.length} Apple-related articles found`)

    return NextResponse.json({
      articles: filteredArticles.slice(0, 20), // Limit to 20 most recent
    })
  } catch (error) {
    console.error("9to5Mac RSS error:", error)
    return NextResponse.json({ error: "Failed to fetch 9to5Mac RSS data" }, { status: 500 })
  }
}
