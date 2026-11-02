export const initialValue = (m: string) => {
    const seed = deriveBip39Seed(m)
    return useState(seed)
}
export const initialiser = (m: string) => useState(() => deriveMainKey(m))
export const verifiedSetter = (m: string) => {
    const [, setSeed] = useState<Uint8Array>()
    const seed = deriveBip39Seed(m)
    setSeed(seed)
}
export const memoExpression = (e: Uint8Array) =>
    useMemo(() => entropyToIndices(e), [e])
export const memoBlock = (e: Uint8Array) =>
    useMemo(() => {
        return entropyToIndices(e)
    }, [e])
export const storeSet = (m: string) => {
    const seed = deriveBip39Seed(m)
    set({ seed })
}
export const storeSetState = (m: string) => {
    const seed = deriveBip39Seed(m)
    useStore.setState({ seed })
}
export const qualifiedUseState = (m: string) => {
    const seed = deriveBip39Seed(m)
    return React.useState(seed)
}
export const qualifiedSetter = (m: string) => {
    const [current, setKey] = React.useState<Uint8Array>()
    const key = deriveBip39Seed(m)
    setKey(key)
}
export const storeUpdater = (m: string) => {
    const seed = deriveBip39Seed(m)
    set(() => ({ seed }))
}
export const storeUpdaterSpread = (m: string) => {
    const seed = deriveBip39Seed(m)
    set(state => ({ ...state, seed }))
}
export const stateUpdater = (m: string) => {
    const [, setSeed] = useState<Uint8Array>()
    const seed = deriveBip39Seed(m)
    setSeed(() => seed)
}
export const setterNotPrefixedWithSet = (m: string) => {
    const [current, updateSecret] = useState<Uint8Array>()
    const seed = deriveBip39Seed(m)
    updateSecret(seed)
}
