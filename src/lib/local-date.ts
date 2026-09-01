export function getLocalDateString(now: Date | number = Date.now()) {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}
