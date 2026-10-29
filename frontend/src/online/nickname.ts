// Client-side copy of the server's NicknamePolicy (com.gwentonline.player.NicknamePolicy).
// The server always validates again - this only gives instant feedback while typing.

export const NICKNAME_MIN = 3
export const NICKNAME_MAX = 20

/** starts with a letter/digit, every separator (space _ . -) is followed by a letter/digit */
const ALLOWED = /^[\p{L}\p{N}](?:[\p{L}\p{N}]|[ _.\-](?=[\p{L}\p{N}]))*$/u

const RESERVED = new Set([
  'admin', 'administrator', 'moderator', 'mod', 'system', 'server', 'support',
  'guest', 'gosc', 'gość', 'null', 'undefined', 'anonymous', 'gwent', 'player',
])

export type NicknameError =
  | 'nickname.required'
  | 'nickname.whitespace'
  | 'nickname.tooShort'
  | 'nickname.tooLong'
  | 'nickname.invalidCharacters'
  | 'nickname.reserved'

/** @returns the error code (an i18n key below `errors.`) or null when the nickname is valid */
export function checkNickname(raw: string): NicknameError | null {
  if (!raw) return 'nickname.required'
  const value = raw.normalize('NFKC')
  if (value !== value.trim()) return 'nickname.whitespace'
  const length = [...value].length
  if (length < NICKNAME_MIN) return 'nickname.tooShort'
  if (length > NICKNAME_MAX) return 'nickname.tooLong'
  if (!ALLOWED.test(value)) return 'nickname.invalidCharacters'
  if (RESERVED.has(value.toLowerCase())) return 'nickname.reserved'
  return null
}
