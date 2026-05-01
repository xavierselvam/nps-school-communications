import { addDays, parseISO, isValid, setHours, setMinutes } from 'date-fns'

interface ExtractedTask {
  userId: string
  emailId: string
  title: string
  dueAt: Date | null
}

const ACTION_PATTERNS = [
  /\b(please\s+)?(pay|payment|fees?)\b/i,
  /\b(please\s+)?(submit|submission)\b/i,
  /\b(please\s+)?(bring|carry)\b/i,
  /\b(please\s+)?(consent|permission\s+form)\b/i,
  /\b(please\s+)?(register|rsvp)\b/i,
  /\b(please\s+)?(sign|signature)\b/i,
  /\breminder\b/i,
  /\bdue\s+(by|on|date)?\b/i,
  /\bdeadline\b/i,
  /\baction\s+required\b/i,
  /\bimportant\s+(notice|announcement|reminder)\b/i,
  /\b(return|send\s+back)\b/i,
  /\b(by|before)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bno\s+later\s+than\b/i,
]

const DATE_PATTERNS = [
  {
    regex: /\b(\d{4}-\d{2}-\d{2})\b/g,
    parse: (m: RegExpMatchArray) => {
      const d = parseISO(m[1])
      return isValid(d) ? d : null
    },
  },
  {
    regex: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
    parse: (m: RegExpMatchArray) => {
      const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
      return isValid(d) ? d : null
    },
  },
  {
    regex: /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(\d{4})?\b/gi,
    parse: (m: RegExpMatchArray, baseDate: Date) => {
      const months: Record<string, number> = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
        apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
        aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
        nov: 10, november: 10, dec: 11, december: 11,
      }
      const month = months[m[2].toLowerCase()]
      const year = m[3] ? Number(m[3]) : baseDate.getFullYear()
      const d = new Date(year, month, Number(m[1]))
      return isValid(d) ? d : null
    },
  },
]

function parseRelativeDate(text: string, baseDate: Date): Date | null {
  const lower = text.toLowerCase()
  
  if (/\btoday\b/.test(lower)) return baseDate
  if (/\btomorrow\b/.test(lower)) return addDays(baseDate, 1)
  
  const nextDayMatch = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)
  if (nextDayMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const targetDay = dayNames.indexOf(nextDayMatch[1])
    if (targetDay >= 0) {
      const currentDay = baseDate.getDay()
      let daysToAdd = targetDay - currentDay
      if (daysToAdd <= 0) daysToAdd += 7
      return addDays(baseDate, daysToAdd)
    }
  }
  
  const thisWeekMatch = lower.match(/\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)
  if (thisWeekMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const targetDay = dayNames.indexOf(thisWeekMatch[1])
    if (targetDay >= 0) {
      const currentDay = baseDate.getDay()
      let daysToAdd = targetDay - currentDay
      if (daysToAdd < 0) daysToAdd += 7
      return addDays(baseDate, daysToAdd)
    }
  }
  
  if (/\bend of (this )?week\b/.test(lower)) {
    const currentDay = baseDate.getDay()
    // If it's Saturday (6) or Sunday (0), find the next Friday
    const daysUntilFriday = currentDay <= 5 ? 5 - currentDay : 5 + (7 - currentDay)
    return addDays(baseDate, daysUntilFriday)
  }
  
  return null
}

function parseTimeHint(text: string, date: Date): Date {
  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  if (timeMatch) {
    let hours = Number(timeMatch[1])
    const minutes = Number(timeMatch[2] ?? 0)
    const ampm = timeMatch[3].toLowerCase()
    if (ampm === 'pm' && hours !== 12) hours += 12
    if (ampm === 'am' && hours === 12) hours = 0
    return setMinutes(setHours(date, hours), minutes)
  }
  if (/\beod\b|\bend of day\b/i.test(text)) {
    return setHours(date, 17)
  }
  return date
}

function findDueDate(text: string, baseDate: Date): Date | null {
  const relative = parseRelativeDate(text, baseDate)
  if (relative) return parseTimeHint(text, relative)

  for (const pattern of DATE_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      const d = pattern.parse(m as RegExpMatchArray, baseDate)
      if (d) return parseTimeHint(text, d)
    }
  }

  return null
}

function extractSentences(text: string): string[] {
  return text
    .split(/[.\n!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10)
}

export function extractTasks(
  emailId: string,
  userId: string,
  subject: string,
  body: string,
  receivedAt: Date
): ExtractedTask[] {
  const tasks: ExtractedTask[] = []
  const seen = new Set<string>()
  const fullText = `${subject}\n${body}`
  const sentences = extractSentences(fullText)

  for (const sentence of sentences) {
    const isActionable = ACTION_PATTERNS.some(p => p.test(sentence))
    if (!isActionable) continue

    const normalizedTitle = sentence.substring(0, 100).toLowerCase().trim()
    if (seen.has(normalizedTitle)) continue
    seen.add(normalizedTitle)

    const dueAt = findDueDate(sentence, receivedAt) ?? findDueDate(fullText, receivedAt)

    tasks.push({
      userId,
      emailId,
      title: sentence.length > 150 ? sentence.substring(0, 147) + '...' : sentence,
      dueAt,
    })

    if (tasks.length >= 5) break
  }

  if (tasks.length === 0 && ACTION_PATTERNS.some(p => p.test(subject))) {
    const dueAt = findDueDate(body, receivedAt)
    tasks.push({
      userId,
      emailId,
      title: subject.length > 150 ? subject.substring(0, 147) + '...' : subject,
      dueAt,
    })
  }

  return tasks
}
