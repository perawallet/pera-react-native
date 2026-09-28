export const returned = (indices: Uint16Array) => {
    const seed = indicesToAlgo25Seed(indices)
    return seed
}

export const returnedAsField = (seed: Uint8Array) => {
    const keyPair = nacl.sign.keyPair.fromSeed(seed)
    return { publicKey: keyPair.publicKey, secretKey: keyPair.secretKey }
}

export const returnedFromArrow = (bytes: Uint8Array) => deriveBip39Seed(bytes)

export const returnedAfterAwait = async (bytes: Uint8Array) => {
    return await deriveBackupMasterKey(bytes)
}

export const returnedWithCleanup = (code: Uint8Array) => {
    return argon2idDerive(code, salt, config).finally(() => zeroBytes(code))
}

export const nullGuarded = (raw: string) => {
    const key = decodePrivateKeyBytes(raw)
    if (!key) return null
    try {
        return sign(key)
    } finally {
        key.fill(0)
    }
}

export const nullGuardedThenLeaked = (raw: string) => {
    const key = decodePrivateKeyBytes(raw)
    if (!key) throw new Error('bad key')
    return sign(key)
}

export const returnedPublicKeyOnly = (seed: Uint8Array) => {
    const keyPair = nacl.sign.keyPair.fromSeed(seed)
    return { publicKey: keyPair.publicKey }
}

// Reported: lanekeep doesn't resolve a shorthand property to its binding.
export const returnedShorthand = (indices: Uint16Array) => {
    const entropy = indicesToEntropy(indices)
    return { entropy }
}

export const returnedDirectly = (indices: Uint16Array) => {
    return indicesToAlgo25Seed(indices)
}

export const returnedInField = (indices: Uint16Array) => {
    const seed = indicesToAlgo25Seed(indices)
    return { walletSeed: seed }
}

export const returnedAsFieldCall = (indices: Uint16Array) => {
    return { walletSeed: indicesToAlgo25Seed(indices) }
}

export const returnedAsFieldAwait = async (bytes: Uint8Array) => {
    return { seed: await deriveBip39Seed(bytes) }
}

export const nullGuardedBlock = (raw: string) => {
    const key = decodePrivateKeyBytes(raw)
    if (!key) {
        return null
    }
    try {
        return sign(key)
    } finally {
        key.fill(0)
    }
}
