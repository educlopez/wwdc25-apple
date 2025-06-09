import { NextResponse } from "next/server"

export async function GET() {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "YouTube API key not configured" }, { status: 500 })
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
        new URLSearchParams({
          part: "snippet",
          channelId: "UCE_M8A5yxnLfW0KghEeajjw", // Apple Developer channel
          q: "WWDC 2025",
          order: "date",
          maxResults: "20",
          key: apiKey,
        }),
    )

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("YouTube API error:", error)
    return NextResponse.json({ error: "Failed to fetch YouTube data" }, { status: 500 })
  }
}
