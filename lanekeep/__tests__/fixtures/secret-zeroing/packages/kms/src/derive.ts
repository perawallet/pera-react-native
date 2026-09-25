export const leaky = (phrase: string) => {
    const seed = seedFromMnemonic(phrase)
    return sign(seed)
}

export const partial = (phrase: string, early: boolean) => {
    const seed = seedFromMnemonic(phrase)
    if (early) return undefined
    seed.fill(0)
    return 1
}

export const zeroed = (phrase: string) => {
    const seed = seedFromMnemonic(phrase)
    try {
        return sign(seed)
    } finally {
        seed.fill(0)
    }
}

export const zeroedByHelper = (phrase: string) => {
    const seed = seedFromMnemonic(phrase)
    try {
        return sign(seed)
    } finally {
        zeroBytes(seed)
    }
}

export const unrelated = (phrase: string) => {
    const seed = seedFromMnemonic(phrase)
    const scratch = new Uint8Array(32)
    scratch.fill(0)
    return sign(seed)
}

export const zeroedAmongOthers = (phrase: string, other: Uint8Array) => {
    const seed = seedFromMnemonic(phrase)
    try {
        return sign(seed)
    } finally {
        zeroBytes(other, seed)
    }
}

export const filledNonZero = (phrase: string) => {
    const seed = seedFromMnemonic(phrase)
    seed.fill(1, 0)
    return sign(seed)
}
