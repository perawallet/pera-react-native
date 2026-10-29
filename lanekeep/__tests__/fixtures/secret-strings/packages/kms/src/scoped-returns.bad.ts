export const returnsTheBuffer = (id: string) => withSecret(id, b => b)
export const returnsACopyViaNew = (id: string) =>
    withSecret(id, b => new Uint8Array(b))
export const returnsACopyViaSlice = (id: string) =>
    withSecret(id, b => b.slice())
export const returnsACopyViaFrom = (id: string) =>
    withSecret(id, b => Uint8Array.from(b))
export const returnsAFieldHoldingACopy = (id: string) =>
    withSecret(id, b => ({ hash: b.slice(0, 32) }))
export const returnsAProducerResult = (id: string) =>
    executeWithMnemonic(id, 'domain', e => entropyToIndices(e))
export const returnsFromABlock = (id: string) =>
    withSecret(id, b => {
        return b
    })
export const returnsAnAwaitedCopy = (id: string) =>
    withSecret(id, async b => await new Uint8Array(b))
export const returnsInAnArray = (id: string) => withSecret(id, b => [b])
export const returnsATernary = (id: string) =>
    withSecret(id, b => (b.length > 0 ? new Uint8Array(b) : null))
