// YouTube API for WWDC session videos
export async function fetchWWDCVideos() {
  const apiKey = process.env.YOUTUBE_API_KEY

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?` +
      new URLSearchParams({
        part: "snippet",
        channelId: "UCE_M8A5yxnLfW0KghEeajjw", // Apple Developer channel
        q: "WWDC 2025",
        order: "date",
        maxResults: "20",
        key: apiKey!,
      }),
  )

  return response.json()
}
