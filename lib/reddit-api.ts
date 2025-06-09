// Reddit API for community discussions and updates
export async function fetchWWDCReddit() {
  const response = await fetch(
    "https://www.reddit.com/r/apple/search.json?" +
      new URLSearchParams({
        q: "WWDC 2025",
        sort: "new",
        restrict_sr: "true",
        limit: "25",
      }),
    {
      headers: {
        "User-Agent": "WWDC25Tracker/1.0",
      },
    },
  )

  return response.json()
}
