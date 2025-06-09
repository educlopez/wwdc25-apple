import { NextResponse } from "next/server"

export async function GET() {
  const now = new Date()
  const spainTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Madrid" }))
  const pacificTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }))

  // WWDC25 actual dates: June 9-13, 2025
  // Keynote: 19:00 - 21:00 Spain time (10:00 AM - 12:00 PM Pacific)
  const keynoteStartHour = 19 // 7 PM Spain time
  const keynoteEndHour = 21 // 9 PM Spain time
  const currentHour = spainTime.getHours()
  const currentMinute = spainTime.getMinutes()
  const currentDay = spainTime.getDay() // 0 = Sunday, 1 = Monday, etc.
  const currentDate = spainTime.getDate()
  const currentMonth = spainTime.getMonth() + 1 // getMonth() returns 0-11

  // Check if it's actually WWDC week (June 9-13, 2025)
  const isWWDCWeek = currentMonth === 6 && currentDate >= 9 && currentDate <= 13 && currentDay >= 1 && currentDay <= 5

  // FOR TESTING: Make it always "live" during WWDC week between 19:00-21:00
  // OR make it live if it's currently between 19:00-21:00 any day for demo purposes
  const isKeynoteTime =
    (isWWDCWeek && currentHour >= keynoteStartHour && currentHour < keynoteEndHour) ||
    (currentHour >= keynoteStartHour && currentHour < keynoteEndHour) // Always live during these hours for testing

  // Calculate minutes until keynote starts
  let minutesUntilKeynote = 0
  if (!isKeynoteTime && currentHour < keynoteStartHour) {
    minutesUntilKeynote = (keynoteStartHour - currentHour) * 60 - currentMinute
  }

  // Calculate minutes until keynote ends (if currently live)
  let minutesUntilEnd = 0
  if (isKeynoteTime) {
    minutesUntilEnd = (keynoteEndHour - currentHour) * 60 - currentMinute
    if (minutesUntilEnd < 0) minutesUntilEnd = 0
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
  if (!isKeynoteTime) {
    if (currentHour < keynoteStartHour) {
      keynoteStartsIn = keynoteStartHour - currentHour
    } else if (currentHour >= keynoteEndHour) {
      // Next day keynote
      keynoteStartsIn = 24 - currentHour + keynoteStartHour
    }
  }

  console.log("Live Status Debug:", {
    currentHour,
    isWWDCWeek,
    isKeynoteTime,
    minutesUntilEnd,
    spainTime: spainTimeFormatted,
  })

  return NextResponse.json({
    isLive: isKeynoteTime,
    spainTime: spainTimeFormatted,
    pacificTime: pacificTimeFormatted,
    keynoteStartsIn,
    currentHour,
    keynoteHour: keynoteStartHour,
    keynoteEndHour,
    isWWDCWeek,
    currentDate: `${currentMonth}/${currentDate}`,
    minutesUntilKeynote,
    minutesUntilEnd,
  })
}
