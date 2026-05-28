import { NextResponse } from "next/server"

export const UPSTREAM_API_BASE = "https://bytedc.view360.cx/flow"
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

const ALLOWED_DEPARTMENTS = new Set(["49", "50", "51", "52", "53"])
const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

export class RequestError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "RequestError"
    this.status = status
  }
}

export function getServerToken(): string {
  const token = process.env.BYTEDC_X_TOKEN
  if (!token) throw new RequestError("Server configuration is missing.", 500)
  return token
}

export function cleanText(value: unknown, name: string, maxLength: number, required = true): string {
  const text = typeof value === "string" ? value.trim() : ""
  if (required && !text) throw new RequestError(`${name} is required.`)
  if (text.length > maxLength) throw new RequestError(`${name} is too long.`)
  return text
}

export function formText(formData: FormData, key: string, label: string, maxLength: number, required = true): string {
  return cleanText(formData.get(key), label, maxLength, required)
}

export function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError("Please provide a valid email.")
  }
}

export function validateDepartment(department: string): void {
  if (!ALLOWED_DEPARTMENTS.has(department)) throw new RequestError("Invalid department.")
}

export function appendAllowedFile(source: FormData, destination: FormData): void {
  const attachment = source.get("attachment")
  if (!(attachment instanceof File) || attachment.size === 0) return

  if (attachment.size > MAX_FILE_SIZE_BYTES) {
    throw new RequestError("Attachment must be 20MB or smaller.")
  }
  if (!ALLOWED_FILE_TYPES.has(attachment.type)) {
    throw new RequestError("Only JPG, PNG, PDF, DOC and DOCX files are allowed.")
  }
  destination.append("attachment", attachment, attachment.name)
}

export async function readUpstreamJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } })
}

export function handleRouteError(error: unknown) {
  if (error instanceof RequestError) return json({ message: error.message }, error.status)
  console.error("Ticket proxy route failed:", error)
  return json({ message: "Unable to process request." }, 500)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function valueAsString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback
}

export type PublicTicket = {
  status: string
  department: string
  createdAt: string
  updatedAt: string
  summary: string
  isResolved: boolean
}

export async function lookupRawTicket(ticketNumber: string, contact: string): Promise<Record<string, unknown>> {
  const queryType = contact.includes("@") ? "customer_email" : "customer_mobile"
  const params = new URLSearchParams({
    query: queryType,
    ticket_number: ticketNumber,
    [queryType]: contact,
  })

  const response = await fetch(`${UPSTREAM_API_BASE}/searchTicketSummaryApi?${params.toString()}`, {
    method: "POST",
    headers: { "X-Token": getServerToken() },
  })
  const data = await readUpstreamJson(response)
  const items = Array.isArray(data.datas) ? data.datas : []
  const first = items[0]

  if (!response.ok || data.status === "failed" || !isObject(first)) {
    throw new RequestError("Ticket not found.", 404)
  }
  return first
}

export function toPublicTicket(ticket: Record<string, unknown>): PublicTicket {
  const status = isObject(ticket.statusObj) ? ticket.statusObj : {}
  const department = isObject(ticket.department) ? ticket.department : {}
  return {
    status: valueAsString(status.name, "Unknown"),
    department: valueAsString(department.name, "-"),
    createdAt: valueAsString(ticket.createdAt),
    updatedAt: valueAsString(ticket.updatedAt),
    summary: valueAsString(ticket.title, "No details available"),
    isResolved: Boolean(ticket.is_resolve),
  }
}
