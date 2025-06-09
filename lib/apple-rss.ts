// Parse Apple's official RSS feeds
export async function fetchAppleNews() {
  const response = await fetch("https://developer.apple.com/news/rss/news.rss")
  const xmlText = await response.text()

  // You'll need to install 'fast-xml-parser'
  const { XMLParser } = require("fast-xml-parser")
  const parser = new XMLParser()
  const result = parser.parse(xmlText)

  return result.rss.channel.item.filter(
    (item: any) => item.title.toLowerCase().includes("wwdc") || item.description.toLowerCase().includes("wwdc"),
  )
}
