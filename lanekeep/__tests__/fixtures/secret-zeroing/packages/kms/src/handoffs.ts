export const transferredToThePage = (request: Request) => {
    const key = computeArgon2id(request)
    self.postMessage(key, { transfer: [key.buffer] })
}

export const copiedToThePage = (request: Request) => {
    const key = computeArgon2id(request)
    self.postMessage(key)
}

export const handedToAStore = (words: string[]) => {
    const indices = mnemonicWordsToIndices(words)
    store.setState({ pendingIndices: handOffSecret(indices) })
}

export const fieldsHandedToAStore = async (indices: Uint16Array) => {
    const prepared = await prepareHDMasterKey({ mnemonicIndices: indices })
    store.start({
        rootKey: handOffSecret(prepared.rootKey),
        entropy: handOffSecret(prepared.entropy),
    })
}

export const handedToACacheInline = (id: string, entropy: Uint8Array) => {
    cache.set(id, handOffSecret(derivePasskeyMainKey(entropy)))
}

export const publicFieldHandedOff = (seed: Uint8Array) => {
    const keyPair = nacl.sign.keyPair.fromSeed(seed)
    register(handOffSecret(keyPair.publicKey))
}

export const transferredSomethingElse = (
    request: Request,
    other: Uint8Array,
) => {
    const key = computeArgon2id(request)
    self.postMessage(key, { transfer: [other.buffer] })
}
