export const leakyEntropy = (indices: Uint16Array) => {
    const entropy = indicesToEntropy(indices)
    return sign(entropy)
}

export const leakyKeyPair = (seed: Uint8Array) => {
    const keyPair = nacl.sign.keyPair.fromSeed(seed)
    return sign(keyPair.publicKey)
}

export const neverBound = (indices: Uint16Array) => {
    keyStore.import(indicesToAlgo25Seed(indices))
}

export const zeroedEntropy = (indices: Uint16Array) => {
    const entropy = indicesToEntropy(indices)
    try {
        return sign(entropy)
    } finally {
        zeroBytes(entropy)
    }
}
