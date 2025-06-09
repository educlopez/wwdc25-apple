// Twitter API v2 for real-time WWDC updates
export async function fetchWWDCTweets() {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN

  const response = await fetch(
    "https://api.twitter.com/2/tweets/search/recent?" +
      new URLSearchParams({
        query: '#WWDC25 OR #WWDC2025 OR "WWDC 25" -is:retweet',
        "tweet.fields": "created_at,author_id,public_metrics,context_annotations",
        "user.fields": "name,username,verified",
        expansions: "author_id",
        max_results: "50",
      }),
    {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
    },
  )

  if (!response.ok) {
    throw new Error("Failed to fetch tweets")
  }

  return response.json()
}
