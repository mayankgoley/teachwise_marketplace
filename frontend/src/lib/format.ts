// ─── NULL-SAFE DATE & CURRENCY FORMATTERS ────────────────────────────────────
// Every function in this file handles null, undefined, empty string, and
// invalid dates gracefully. They never throw. They return '—' as fallback.
// This protects every page in the app from RangeError crashes.

function safeDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') return null
  const d = new Date(dateStr)
  return isNaN(d.getTime()) || !isFinite(d.getTime()) ? null : d
}

function safeDateFromParts(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  // Append T00:00:00 to avoid timezone shifting plain date strings
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

// ─── DATE ────────────────────────────────────────────────────────────────────

export function formatDate(
  dateStr: string | null | undefined,
  fallback = '\u2014'
): string {
  const d = safeDateFromParts(dateStr)
  if (!d) return fallback
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(d)
  } catch {
    return fallback
  }
}

export function formatDateShort(
  dateStr: string | null | undefined,
  fallback = '\u2014'
): string {
  const d = safeDateFromParts(dateStr)
  if (!d) return fallback
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric',
    }).format(d)
  } catch {
    return fallback
  }
}

export function formatDateFull(
  dateStr: string | null | undefined,
  fallback = '\u2014'
): string {
  const d = safeDateFromParts(dateStr)
  if (!d) return fallback
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }).format(d)
  } catch {
    return fallback
  }
}

export function formatDateForInput(
  dateStr: string | null | undefined
): string {
  // Returns YYYY-MM-DD for use in <input type="date">
  const d = safeDateFromParts(dateStr)
  if (!d) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─── TIME ─────────────────────────────────────────────────────────────────────

export function formatTime(
  timeStr: string | null | undefined,
  fallback = '\u2014'
): string {
  if (!timeStr || typeof timeStr !== 'string') return fallback
  const parts = timeStr.split(':').map(Number)
  if (parts.length < 2 || parts.some(isNaN)) return fallback
  const [hours, minutes] = parts
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback
  try {
    const d = new Date()
    d.setHours(hours, minutes, 0, 0)
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(d)
  } catch {
    return fallback
  }
}

export function formatTimeRange(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  fallback = '\u2014'
): string {
  const start = formatTime(startTime)
  const end = formatTime(endTime)
  if (start === '\u2014' || end === '\u2014') return fallback
  return `${start} \u2013 ${end}`
}

// ─── DURATION ─────────────────────────────────────────────────────────────────

export function formatDuration(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  fallback = '\u2014'
): string {
  if (!startTime || !endTime) return fallback
  try {
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    if ([sh, sm, eh, em].some(isNaN)) return fallback
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins <= 0) return fallback
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m}min`
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  } catch {
    return fallback
  }
}

export function formatDurationMinutes(
  minutes: number | null | undefined,
  fallback = '\u2014'
): string {
  if (minutes == null || isNaN(minutes) || minutes <= 0) return fallback
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ─── RELATIVE TIME ─────────────────────────────────────────────────────────────

export function formatRelativeTime(
  dateStr: string | null | undefined,
  fallback = '\u2014'
): string {
  if (!dateStr) return fallback
  const d = safeDate(dateStr)
  if (!d) return fallback
  try {
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    if (!isFinite(diffMs)) return fallback
    const diffMins = Math.floor(Math.abs(diffMs) / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    const isFuture = diffMs < 0
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return isFuture ? `in ${diffMins}m` : `${diffMins}m ago`
    if (diffHours < 24) return isFuture ? `in ${diffHours}h` : `${diffHours}h ago`
    if (diffDays < 7) return isFuture ? `in ${diffDays}d` : `${diffDays}d ago`
    return formatDate(dateStr, fallback)
  } catch {
    return fallback
  }
}

export function formatRelativeOrDate(
  dateStr: string | null | undefined,
  fallback = '\u2014'
): string {
  // Recent (< 7 days): relative. Older: full date.
  if (!dateStr) return fallback
  const d = safeDate(dateStr)
  if (!d) return fallback
  const diffDays = Math.abs(
    (new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  )
  return diffDays < 7
    ? formatRelativeTime(dateStr, fallback)
    : formatDate(dateStr, fallback)
}

// ─── CURRENCY ─────────────────────────────────────────────────────────────────

export function formatCurrency(
  amount: number | null | undefined,
  fallback = '$0.00'
): string {
  if (amount == null || isNaN(amount) || !isFinite(amount)) return fallback
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return fallback
  }
}

export function formatCurrencyCompact(
  amount: number | null | undefined,
  fallback = '$0'
): string {
  if (amount == null || isNaN(amount) || !isFinite(amount)) return fallback
  try {
    if (Math.abs(amount) >= 1000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD',
        notation: 'compact', maximumFractionDigits: 1,
      }).format(amount)
    }
    return formatCurrency(amount, fallback)
  } catch {
    return fallback
  }
}

// ─── TEXT HELPERS ─────────────────────────────────────────────────────────────

export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return ''
  return fullName.trim().split(' ')[0] ?? ''
}

export function truncate(
  text: string | null | undefined,
  maxLength: number,
  suffix = '...'
): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - suffix.length).trimEnd() + suffix
}

export function capitalize(str: string | null | undefined): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function snakeToTitle(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ─── DATE COMPARISON HELPERS ──────────────────────────────────────────────────

export function isOverdue(
  dueDateStr: string | null | undefined
): boolean {
  if (!dueDateStr) return false
  const d = safeDateFromParts(dueDateStr)
  if (!d) return false
  return d < new Date()
}

export function isDueWithinDays(
  dueDateStr: string | null | undefined,
  days: number
): boolean {
  if (!dueDateStr) return false
  const d = safeDateFromParts(dueDateStr)
  if (!d) return false
  const now = new Date()
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  return d >= now && d <= cutoff
}

export function daysBetween(
  fromStr: string | null | undefined,
  toStr: string | null | undefined
): number | null {
  const from = safeDate(fromStr)
  const to = safeDate(toStr)
  if (!from || !to) return null
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null
  const dob = safeDateFromParts(dateOfBirth)
  if (!dob) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age
}
