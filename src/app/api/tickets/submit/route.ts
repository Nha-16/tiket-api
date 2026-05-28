import { NextRequest } from "next/server"
import {
  UPSTREAM_API_BASE,
  appendAllowedFile,
  formText,
  getServerToken,
  handleRouteError,
  json,
  readUpstreamJson,
  validateDepartment,
  validateEmail,
} from "../_shared"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData()
    const name = formText(incoming, "name", "Full name", 120)
    const mobile = formText(incoming, "mobile", "Phone number", 40)
    const email = formText(incoming, "email", "Email", 160)
    const company = formText(incoming, "company", "Company", 160, false)
    const title = formText(incoming, "title", "Subject", 200)
    const description = formText(incoming, "description", "Description", 5000)
    const department = formText(incoming, "department", "Department", 10)

    validateEmail(email)
    validateDepartment(department)

    // TODO before public launch: verify CAPTCHA here before forwarding.
    const outgoing = new FormData()
    outgoing.append("name", name)
    outgoing.append("mobile", mobile)
    outgoing.append("email", email)
    outgoing.append("company", company)
    outgoing.append("title", title)
    outgoing.append("description", description)
    outgoing.append("department", department)
    appendAllowedFile(incoming, outgoing)

    const response = await fetch(`${UPSTREAM_API_BASE}/webFormTicket`, {
      method: "POST",
      headers: { "X-Token": getServerToken() },
      body: outgoing,
    })
    const upstream = await readUpstreamJson(response)
    if (!response.ok) return json({ message: "Ticket submission failed." }, response.status)

    const ticketOBJ = typeof upstream.ticketOBJ === "object" && upstream.ticketOBJ !== null
      ? (upstream.ticketOBJ as Record<string, unknown>)
      : {}
    const ticketNumber = typeof ticketOBJ.ticket_number === "string" ? ticketOBJ.ticket_number : undefined
    return json({ message: "Ticket submitted successfully.", ticketNumber }, 201)
  } catch (error) {
    return handleRouteError(error)
  }
}
