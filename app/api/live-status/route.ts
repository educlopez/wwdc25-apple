import { NextResponse } from "next/server"

export async function GET() {
  const now = new Date()
  const spainTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }))
  const pacificTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }))

  // WWDC25 actual dates: June 9-13, 2025
  // Keynote starts at 19:00 Spain time (10:00 AM Pacific)
  const keynoteHour = 19 // 7 PM Spain time
  const currentHour = spainTime.getHours()
  const currentMinute = spainTime.getMinutes()
  const currentDay = spainTime.getDay() // 0 = Sunday, 1 = Monday, etc.
  const currentDate = spainTime.getDate()
  const currentMonth = spainTime.getMonth() + 1 // getMonth() returns 0-11

  // Check if it's actually WWDC week (June 9-13, 2025)
  const isWWDCWeek = currentMonth === 6 && currentDate >= 9 && currentDate <= 13 && currentDay >= 1 && currentDay <= 5

  // Only consider "live" during actual keynote hours on WWDC days
  const isKeynoteTime =
    isWWDCWeek &&
    ((currentHour === keynoteHour && currentMinute >= 0) || // 7:00 PM - 7:59 PM
      currentHour === keynoteHour + 1 || // 8:00 PM - 8:59 PM
      currentHour === keynoteHour + 2 || // 9:00 PM - 9:59 PM
      (currentHour === keynoteHour + 3 && currentMinute <= 30)) // 10:00 PM - 10:30 PM

  // Calculate minutes until keynote
  let minutesUntilKeynote = 0
  if (isWWDCWeek && !isKeynoteTime) {
    if (currentHour < keynoteHour) {
      minutesUntilKeynote = (keynoteHour - currentHour) * 60 - currentMinute
    } else if (currentHour === keynoteHour - 1) {
      minutesUntilKeynote = 60 - currentMinute
    }
  }

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

  // Calculate hours until next keynote (if not live)
  let keynoteStartsIn = 0
  if (!isKeynoteTime && isWWDCWeek) {
    if (currentHour < keynoteHour) {
      keynoteStartsIn = keynoteHour - currentHour
    } else {
      // Next day keynote
      keynoteStartsIn = 24 - currentHour + keynoteHour
    }
  }

  return NextResponse.json({
    isLive: isKeynoteTime,
    spainTime: spainTimeFormatted,
    pacificTime: pacificTimeFormatted,
    keynoteStartsIn,
    currentHour,
    keynoteHour,
    isWWDCWeek,
    currentDate: `${currentMonth}/${currentDate}`,
    minutesUntilKeynote,
  })
}
