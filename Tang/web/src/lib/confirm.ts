// Step 3 form rules. Mirrors api/app/schemas.py ConfirmRequest (do_number 1-64, notes 1-2000, actual int >= 0).
export type ConfirmValues = { doNumber: string; actual: string; notes: string }
export type ConfirmErrors = { doNumber?: true; actual?: true; notes?: true }

export const MAX_DO = 64
export const MAX_NOTES = 2000

// Whole number >= 0, or null (empty, negative, decimal, text).
export function parseActual(text: string): number | null {
  const s = text.trim()
  return /^\d{1,9}$/.test(s) ? Number(s) : null
}

export function validateConfirm(v: ConfirmValues): ConfirmErrors {
  const errors: ConfirmErrors = {}
  const doNumber = v.doNumber.trim()
  const notes = v.notes.trim()
  if (!doNumber || doNumber.length > MAX_DO) errors.doNumber = true
  if (parseActual(v.actual) === null) errors.actual = true
  if (!notes || notes.length > MAX_NOTES) errors.notes = true
  return errors
}

// actual - model; positive = operator counted more than the model.
export const variance = (actual: number, model: number) => actual - model

export const formatVariance = (v: number) => (v > 0 ? `+${v}` : String(v))
