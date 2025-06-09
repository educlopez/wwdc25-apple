// NewsAPI for WWDC coverage from major tech outlets
export async function fetchWWDCNews() {
  const apiKey = process.env.NEWS_API_KEY

  const response = await fetch(
    `https://newsapi.org/v2/everything?` +
      new URLSearchParams({
        q: 'WWDC 2025 OR "Apple WWDC" OR "iOS 19" OR "macOS 15"',
        sources: "techcrunch,the-verge,ars-technica,wired,engadget",
        sortBy: "publishedAt",
        language: "en",
        pageSize: "20",
      }),
    {
      headers: {
        "X-API-Key": apiKey!,
      },
    },
  )

  return response.json()
}
