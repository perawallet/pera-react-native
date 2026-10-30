export const zeroableCopy = () => {
    const [, setIndices] = useState<Uint16Array>()
    return executeWithMnemonic('id', 'domain', src => setIndices(src.slice()))
}
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
export const updaterWithoutSecret = (m: string) => {
    const seed = deriveBip39Seed(m)
    set(state => ({ ...state, size: seed.length }))
}
// A single binding has no setter slot, so a call to that name is not a state
// write however the secret reaches it.
export const singleBindingIsNotASetter = (m: string) => {
    const [importedKey] = useState<Uint8Array>()
    const seed = deriveBip39Seed(m)
    importedKey(seed)
}
// An ordinary call is not a state write, whatever it is handed.
export const anOrdinaryCallIsNotASetter = (m: string) => {
    const seed = deriveBip39Seed(m)
    registerThing(seed)
}
