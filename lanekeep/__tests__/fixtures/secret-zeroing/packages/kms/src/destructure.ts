export const secretFieldNeverBound = (seed: Uint8Array) => {
    const { publicKey } = nacl.sign.keyPair.fromSeed(seed)
    return publicKey
}

export const secretFieldBound = (seed: Uint8Array) => {
    const { publicKey, secretKey } = nacl.sign.keyPair.fromSeed(seed)
    try {
        return publicKey.slice()
    } finally {
        zeroBytes(secretKey)
    }
}

export const secretFieldRenamed = (authSeed: Uint8Array) => {
    const { publicKey, secretKey: authSecretKey } =
        deriveBackupAuthKeypair(authSeed)
    try {
        return register(publicKey)
    } finally {
        zeroBytes(authSecretKey)
    }
}

export const secretsInRest = async (mnemonic: Uint16Array) => {
    const { authPublicKey, ...secrets } = await deriveBackupKeys(mnemonic)
    try {
        return register(authPublicKey)
    } finally {
        zeroBytes(secrets.encryptionKey, secrets.itemKey)
    }
}
