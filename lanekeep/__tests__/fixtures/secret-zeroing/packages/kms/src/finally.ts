export const wipedAfterUse = (masterKey: Uint8Array) => {
    const itemKey = hkdf(sha256, masterKey, salt, info, 32)
    sign(itemKey)
    itemKey.fill(0)
    return 1
}

export const wipedOnlyOnError = (masterKey: Uint8Array) => {
    const itemKey = hkdf(sha256, masterKey, salt, info, 32)
    try {
        return sign(itemKey)
    } catch (error) {
        itemKey.fill(0)
        throw error
    }
}

export const wipedInFinally = (masterKey: Uint8Array) => {
    const itemKey = hkdf(sha256, masterKey, salt, info, 32)
    try {
        return sign(itemKey)
    } finally {
        itemKey.fill(0)
    }
}
