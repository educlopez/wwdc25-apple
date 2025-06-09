import { NextResponse } from "next/server"

// Mock WWDC API endpoint
export async function GET() {
  // In a real implementation, you would fetch from Apple's official API
  // or a third-party service that aggregates WWDC data

  const mockData = {
    updates: [
      {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: "keynote",
        title: "iOS 19 Features Revealed",
        description:
          "Apple showcases new AI-powered features coming to iOS 19, including enhanced Siri capabilities and improved privacy controls.",
        speaker: "Craig Federighi",
        isLive: Math.random() > 0.7,
      },
      {
        id: (Date.now() - 1).toString(),
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: "announcement",
        title: "New Developer Tools",
        description: "Xcode 16 introduces AI-assisted coding and improved debugging tools for faster development.",
        speaker: "Developer Relations Team",
      },
    ],
    stats: {
      totalAttendees: 6000 + Math.floor(Math.random() * 100),
      liveViewers: 2500000 + Math.floor(Math.random() * 10000),
      sessionsToday: 45,
      announcementsCount: 12 + Math.floor(Math.random() * 3),
    },
  }

  return NextResponse.json(mockData)
}
