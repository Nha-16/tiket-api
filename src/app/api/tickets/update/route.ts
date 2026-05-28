import { NextRequest } from "next/server"
import {
  UPSTREAM_API_BASE,
  appendAllowedFile,
  formText,
  getServerToken,
  handleRouteError,
  json,
  lookupRawTicket,
  readUpstreamJson,
} from "../_shared"

export const runtime = "edge"

function appendIdentifier(formData: FormData, ticket: Record<string, unknown>, sourceKey: string, targetKey: string) {
  const value = ticket[sourceKey]
  if (typeof value === "string" || typeof value === "number") {
    formData.append(targetKey, String(value))
  }
}

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData()
    const ticketNumber = formText(incoming, "ticketNumber", "Ticket number", 80)
    const contact = formText(incoming, "contact", "Phone number or email", 160)
    const message = formText(incoming, "message", "Follow-up message", 5000)

    // Keep raw ticket fields on the server only; never send them to browser.
    // TODO before public launch: require OTP/ownership verification before update.
    const rawTicket = await lookupRawTicket(ticketNumber, contact)
    const outgoing = new FormData()
    outgoing.append("ticket_number", ticketNumber)
    outgoing.append("mobile", contact) // Matches your existing ByteDC update payload; confirm email updates with backend.
    outgoing.append("message", message)
    appendIdentifier(outgoing, rawTicket, "id", "ticket_id")
    appendIdentifier(outgoing, rawTicket, "_id", "ticket_uuid")
    appendAllowedFile(incoming, outgoing)

    const response = await fetch(`${UPSTREAM_API_BASE}/updateTicket`, {
      method: "POST",
      headers: { "X-Token": getServerToken() },
      body: outgoing,
    })
    const upstream = await readUpstreamJson(response)
    if (!response.ok || upstream.status === false) {
      return json({ message: "Failed to update ticket." }, response.ok ? 400 : response.status)
    }
    return json({ message: "Ticket updated successfully." })
  } catch (error) {
    return handleRouteError(error)
  }
}
