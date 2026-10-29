export const plainToString = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.toString()
}
export const otherEncoding = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.toString('ascii')
}
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
