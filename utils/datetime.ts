const pad = (n: number) => String(n).padStart(2, '0')

/** ISO → valeur d'un <input type="datetime-local"> (heure locale du navigateur). */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Valeur d'un <input type="datetime-local"> → ISO (UTC). */
export function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** Ex. « 18:00 » */
export function formatTime(iso: string | number | Date): string {
  return timeFormat.format(new Date(iso))
}

/** Ex. « 18:00 » aujourd'hui, sinon « samedi 12 octobre à 18:00 ». */
export function formatDeadline(iso: string, nowMs: number): string {
  const d = new Date(iso)
  const sameDay = new Date(nowMs).toDateString() === d.toDateString()
  return sameDay ? formatTime(d) : `${dayFormat.format(d)} à ${formatTime(d)}`
}

/** Durée restante lisible : « 2 j 3 h », « 1 h 42 min », « 12 min 05 s ». */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (days > 0) return `${days} j ${hours} h`
  if (hours > 0) return `${hours} h ${pad(minutes)} min`
  return `${minutes} min ${pad(seconds)} s`
}

/** Ex. « sam. 12 oct., 18:00 » */
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFormat.format(new Date(iso)) : '—'
}
