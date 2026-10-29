export const zeroableCopy = () =>
    executeWithMnemonic('id', 'domain', src => setIndices(src.slice()))
export const notAStateSetter = (m: string) => {
    const seed = deriveBip39Seed(m)
    setRefreshHandler(seed)
}
export const handedOff = (e: Uint8Array) => {
    const [, setSeed] = useState<Uint16Array>()
    setSeed(handOffSecret(entropyToIndices(e)))
}
export const nonSecretState = (name: string) => useState(name)
export const nonSecretMemo = (name: string) => useMemo(() => name, [name])
export const nonSecretStore = (name: string) => set({ name })
export const lengthInState = (m: string) => {
    const seed = deriveBip39Seed(m)
    return useState(seed.length)
}
export const handedOffToAStore = (m: string) => {
    const seed = deriveBip39Seed(m)
    set({ seed: handOffSecret(seed) })
}
export const someOtherSet = (m: string) => {
    const seed = deriveBip39Seed(m)
    registry.set(seed)
}
