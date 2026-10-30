export const nonSecretHex = (id: Uint8Array) => id.toString('hex')
export const nonSecretBytesToHex = (id: Uint8Array) => bytesToHex(id)
export const nonSecretJoin = (words: string[]) => words.join(' ')
export const nonSecretDecode = (body: Uint8Array) =>
    new TextDecoder().decode(body)
export const nonSecretTemplate = (name: string) => `k=${name}`
export const nonSecretConcat = (name: string) => 'k=' + name
export const secretLengthInATemplate = (m: string) => {
    const seed = deriveBip39Seed(m)
    return `${seed.length} bytes`
}
export const comparison = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed === other || seed + 1
}
export const publicKeyHex = (m: string) => {
    const pair = deriveBackupKeys(m)
    return Buffer.from(pair.authPublicKey).toString('hex')
}
export const aNonDecoderDecode = (m: string) => {
    const seed = deriveBip39Seed(m)
    return codec.decode(seed)
}
export const radixToString = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.length.toString(16)
}
export const nonSecretStringified = (id: Uint8Array) =>
    String(id) + JSON.stringify(id) + btoa(id)
export const nonSecretFromCharCode = (id: Uint8Array) =>
    String.fromCharCode(...id) + String.fromCharCode.apply(null, id)
export const secretLengthStringified = (m: string) => {
    const seed = deriveBip39Seed(m)
    return String(seed.length) + JSON.stringify({ size: seed.byteLength })
}
