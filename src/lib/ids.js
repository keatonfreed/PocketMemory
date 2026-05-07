const SHORT_ID_LENGTH = 8
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

export function newShortId(prefix = '', length = SHORT_ID_LENGTH) {
    const cleanPrefix = String(prefix || '').toLowerCase()
    const bodyLength = Math.max(1, length - cleanPrefix.length)
    const bytes = new Uint8Array(bodyLength)
    crypto.getRandomValues(bytes)
    return `${cleanPrefix}${Array.from(bytes, byte => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')}`
}

export const newDocId = () => newShortId('d')

export const newItemId = () => newShortId('i')
