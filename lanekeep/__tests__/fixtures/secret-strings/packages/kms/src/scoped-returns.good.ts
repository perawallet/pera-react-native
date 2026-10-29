export const handedOffBuffer = (id: string) =>
    withSecret(id, b => handOffSecret(b))
export const handedOffCopy = (id: string) =>
    withSecret(id, b => handOffSecret(new Uint8Array(b)))
export const handedOffSlice = (id: string) =>
    withSecret(id, b => handOffSecret(b.slice()))
export const handedOffFrom = (id: string) =>
    withSecret(id, b => handOffSecret(Uint8Array.from(b)))
export const handedOffField = (id: string) =>
    withSecret(id, b => ({ hash: handOffSecret(b.slice(0, 32)) }))
export const handedOffProducerResult = (id: string) =>
    executeWithMnemonic(id, 'domain', e => handOffSecret(entropyToIndices(e)))
export const handedOffFromABlock = (id: string) =>
    withSecret(id, b => {
        return handOffSecret(b)
    })
export const returnsASignature = (id: string) => withSecret(id, b => sign(b))
export const returnsALength = (id: string) => withSecret(id, b => b.length)
export const nestedHelper = (id: string) =>
    withBackupAuthSecretKey(k => withBackupItemKey(id, i => use(k, i)))
export const copyInsideACallback = (id: string) =>
    withSecret(id, b => {
        const copy = new Uint8Array(b)
        return sign(copy)
    })
export const notAScopedHelper = (b: Uint8Array) => withRetry(() => b)
