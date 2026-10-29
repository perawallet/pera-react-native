export const resultOfAScopedHelper = async (id: string) => { const sig = await withSecret(id, b => sign(b)); return bytesToHex(sig) }
export const publicKeyOfADerivedPair = (p: string) => bytesToHex(deriveBackupKeys(p).authPublicKey)
export const destructuredPublicKey = (p: string) => { const { authPublicKey } = deriveBackupKeys(p); return bytesToHex(authPublicKey) }
export const notAScopedHelper = (b: Uint8Array) => withRetry(() => bytesToHex(b))
export const callbackOfAnotherHelper = () => withRetry(b => bytesToHex(b))
export const lengthOnly = (m: string) => { const seed = deriveBip39Seed(m); return `${seed.length}` }
export const namedHandler = (id: string) => withSecret(id, parsePinRecord)
