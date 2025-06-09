import { NextResponse } from "next/server"

export async function GET() {
  const now = new Date()
  const spainTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }))
  const pacificTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }))

  // WWDC typically starts at 10:00 AM Pacific (19:00 Spain time)
  const keynoteHour = 19 // 7 PM Spain time
  const currentHour = spainTime.getHours()
  const currentMinute = spainTime.getMinutes()

  // Consider "live" from 30 minutes before to 3 hours after keynote
  const isLiveTime =
    (currentHour === keynoteHour - 1 && currentMinute >= 30) ||
    (currentHour >= keynoteHour && currentHour <= keynoteHour + 2) ||
    (currentHour === keynoteHour + 3 && currentMinute <= 30)

  // Check if it's a weekday (WWDC typically Monday-Friday)
  const isWeekday = spainTime.getDay() >= 1 && spainTime.getDay() <= 5

  // Format times nicely
  const spainTimeFormatted = spainTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Madrid",
  })

  const pacificTimeFormatted = pacificTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
  })

  return NextResponse.json({
    isLive: isLiveTime && isWeekday,
    spainTime: spainTimeFormatted,
    pacificTime: pacificTimeFormatted,
    keynoteStartsIn: currentHour < keynoteHour ? keynoteHour - currentHour : 0,
    currentHour,
    keynoteHour,
  })
}
