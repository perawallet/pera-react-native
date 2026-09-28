export const fieldsZeroed = (mnemonic: Uint16Array) => {
    const keys = deriveBackupKeys(mnemonic)
    try {
        return register(keys.authPublicKey)
    } finally {
        zeroBytes(keys.encryptionKey, keys.authSecretKey, keys.itemKey)
    }
}

export const fieldZeroedWithFill = (seed: Uint8Array) => {
    const keyPair = nacl.sign.keyPair.fromSeed(seed)
    try {
        return keyPair.publicKey.slice()
    } finally {
        keyPair.secretKey.fill(0)
    }
}

export const aliasZeroed = (masterKey: Uint8Array) => {
    const itemKey = hkdf(sha256, masterKey, salt, info, 32)
    const key = itemKey
    try {
        return hash(key)
    } finally {
        wipeBytes(key)
    }
}

export const publicFieldZeroed = (seed: Uint8Array) => {
    const keyPair = nacl.sign.keyPair.fromSeed(seed)
    try {
        return keyPair.publicKey.slice()
    } finally {
        zeroBytes(keyPair.publicKey)
    }
}

export const publicFieldFilled = (seed: Uint8Array) => {
    const keyPair = nacl.sign.keyPair.fromSeed(seed)
    try {
        return keyPair.publicKey.slice()
    } finally {
        keyPair.publicKey.fill(0)
    }
}

export const wipedWithWipeSecrets = (indices: Uint16Array) => {
    const seed = indicesToAlgo25Seed(indices)
    try {
        return sign(seed)
    } finally {
        wipeSecrets(seed)
    }
}

export const wipedOnOneArm = (masterKey: Uint8Array, other: Uint8Array) => {
    const itemKey = hkdf(sha256, masterKey, salt, info, 32)
    try {
        return hash(itemKey)
    } finally {
        zeroBytes(other ? other : itemKey)
    }
}
