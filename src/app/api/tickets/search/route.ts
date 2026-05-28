import { NextRequest } from "next/server"
import { cleanText, handleRouteError, json, lookupRawTicket, toPublicTicket } from "../_shared"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const ticketNumber = cleanText(body.ticketNumber, "Ticket number", 80)
    const contact = cleanText(body.contact, "Phone number or email", 160)

    // TODO before public launch: add rate limiting and OTP verification.
    const rawTicket = await lookupRawTicket(ticketNumber, contact)
    return json({ message: "Ticket found.", ticket: toPublicTicket(rawTicket) })
  } catch (error) {
    return handleRouteError(error)
  }
}
