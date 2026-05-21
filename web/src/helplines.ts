/**
 * Course-wise Admission Helpline for Admissions 2026-27.
 * Single source of truth — update here and both the WhatsApp/SMS message
 * and the Outreach tab panel pick it up.
 */
export interface Helpline {
  course: string         // short tag, e.g. "BCA"
  fullName: string       // full programme name
  lead: string           // program lead's name (with salutation)
  phone: string          // display phone with spaces — pretty for humans
}

export const HELPLINES: Helpline[] = [
  { course: 'BCA',       fullName: 'Bachelor of Computer Application',  lead: 'Ms. Leena Gupta',     phone: '+91 87962 83551' },
  { course: 'MCA',       fullName: 'Master of Computer Application',    lead: 'Mr. Ashish Nayyar',   phone: '+91 87964 52755' },
  { course: 'BBA',       fullName: 'Bachelor of Business Admin',        lead: 'Dr. Deepali Saluja',  phone: '+91 87964 52756' },
  { course: 'B.Com (H)', fullName: 'B.Com (Hons.)',                     lead: 'Dr. Raghav Jain',     phone: '+91 87964 52757' },
  { course: 'MBA',       fullName: 'Master of Business Administration', lead: 'Dr. Mandeep Singh',   phone: '+91 95600 98709' },
  { course: 'BA (JMC)',  fullName: 'Journalism & Mass Communication',   lead: 'Dr. Nivedita Sharma', phone: '+91 72178 72947' },
]

/** Strip common Indian salutations and return the first remaining word. */
export function firstName(full: string): string {
  const parts = (full || '').trim().split(/\s+/)
  const skip = /^(mr|mrs|ms|miss|dr|sh|smt|shri|prof)\.?$/i
  for (const p of parts) {
    if (!skip.test(p)) return p
  }
  return parts[0] || full
}

/** WhatsApp / SMS message body. URL goes on its own line so previews work. */
export function buildOutreachMessage(contactName: string, talkUrl: string): string {
  const first = firstName(contactName) || 'there'
  const helplines = HELPLINES
    .map(h => `• ${h.course} — ${h.lead} · ${h.phone}`)
    .join('\n')
  return (
    `Hi ${first} 👋\n` +
    `\n` +
    `This is the IITM admissions team — Admissions 2026-27 are open.\n` +
    `\n` +
    `Have a quick voice chat with our AI counselor Anya:\n` +
    `${talkUrl}\n` +
    `\n` +
    `📞 Or talk directly to the program lead for your course:\n` +
    `${helplines}`
  )
}

/** Build a tel: link from a display phone like "+91 87962 83551". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`
}
