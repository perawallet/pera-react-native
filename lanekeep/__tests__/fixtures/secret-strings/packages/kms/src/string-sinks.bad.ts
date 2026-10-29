export const toHex = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.toString('hex')
}
export const toBase64 = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.toString('base64')
}
export const toBase64Url = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.toString('base64url')
}
export const toUtf8 = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.toString('utf8')
}
export const toUtf8Dashed = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.toString('utf-8')
}
export const copiedThenHex = (m: string) => {
    const seed = deriveBip39Seed(m)
    return Buffer.from(seed).toString('hex')
}
export const bytesToHexCall = (m: string) => {
    const seed = deriveBip39Seed(m)
    return bytesToHex(seed)
}
export const toHexCall = (m: string) => {
    const seed = deriveBip39Seed(m)
    return toHex(seed)
}
export const encodeToBase64Call = (m: string) => {
    const seed = deriveBip39Seed(m)
    return encodeToBase64(seed)
}
export const toBase64Call = (m: string) => {
    const seed = deriveBip39Seed(m)
    return toBase64(seed)
}
export const toBase64UrlCall = (m: string) => {
    const seed = deriveBip39Seed(m)
    return toBase64Url(seed)
}
export const bytesToBase64UrlCall = (m: string) => {
    const seed = deriveBip39Seed(m)
    return bytesToBase64Url(seed)
}
export const entropyToMnemonicCall = (m: string) => {
    const entropy = mnemonicToEntropy(m)
    return entropyToMnemonic(entropy)
}
export const memberEncoder = (m: string) => {
    const seed = deriveBip39Seed(m)
    return codec.bytesToHex(seed)
}
export const joined = (m: string) => {
    const words = mnemonicWordsToIndices(m)
    return words.join(' ')
}
export const joinedNoSeparator = (m: string) => {
    const words = mnemonicWordsToIndices(m)
    return words.join()
}
export const methodToHex = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.toHex()
}
export const methodToBase64 = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed.toBase64()
}
export const decodedByANewDecoder = (m: string) => {
    const seed = deriveBip39Seed(m)
    return new TextDecoder().decode(seed)
}
export const decodedByAnInstance = (m: string) => {
    const seed = deriveBip39Seed(m)
    return decoder.decode(seed)
}
export const decodedByATextDecoder = (m: string) => {
    const seed = deriveBip39Seed(m)
    return textDecoder.decode(seed)
}
export const decodedByAConstant = (m: string) => {
    const seed = deriveBip39Seed(m)
    return UTF8_DECODER.decode(seed)
}
export const templated = (m: string) => {
    const seed = deriveBip39Seed(m)
    return `k=${seed}`
}
export const prefixed = (m: string) => {
    const seed = deriveBip39Seed(m)
    return 'k=' + seed
}
export const suffixed = (m: string) => {
    const seed = deriveBip39Seed(m)
    return seed + ''
}
export const mappedToWords = (m: string) => {
    const idx = mnemonicWordsToIndices(m)
    return Array.from(idx, indexToWord).join(' ')
}
