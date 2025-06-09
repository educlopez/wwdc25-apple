import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch(
      "https://www.reddit.com/r/apple/search.json?" +
        new URLSearchParams({
          q: "WWDC 2025 OR WWDC25",
          sort: "new",
          restrict_sr: "true",
          limit: "25",
        }),
      {
        headers: {
          "User-Agent": "WWDC25Tracker/1.0 (by /u/yourredditusername)",
        },
      },
    )

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Reddit API error:", error)
    return NextResponse.json({ error: "Failed to fetch Reddit data" }, { status: 500 })
  }
}
