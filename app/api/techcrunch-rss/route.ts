import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://techcrunch.com/tag/apple/feed/", {
      headers: {
        "User-Agent": "WWDC25Tracker/1.0",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch TechCrunch RSS: ${response.status}`);
    }
    const xmlText = await response.text();
    // Extract items using regex (simple for RSS)
    const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
    const articles = items.map((item) => {
      const title =
        item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
        item.match(/<title>(.*?)<\/title>/)?.[1] ||
        "";
      const description =
        item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
        item.match(/<description>(.*?)<\/description>/)?.[1] ||
        "";
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
      return {
        title: title.trim(),
        description: description.trim(),
        url: link.trim(),
        publishedAt: pubDate
          ? new Date(pubDate).toISOString()
          : new Date().toISOString(),
        source: { name: "TechCrunch" },
      };
    });
    // Sort by date (most recent first)
    articles.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("❌ TechCrunch RSS error:", error);
    return NextResponse.json(
      { error: "Failed to fetch TechCrunch RSS data" },
      { status: 500 }
    );
  }
}
