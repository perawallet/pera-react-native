export const bareProducer = (m: string) => bytesToHex(deriveBip39Seed(m))
export const memberProducer = (m: string) =>
    bytesToHex(kms.mnemonicToEntropy(m))
export const utf8Producer = (b: Uint8Array) => bytesToHex(utf8BytesToIndices(b))
export const executeWithKeyArg = (id: string) =>
    executeWithKey(id, b => bytesToHex(b))
export const executeWithMnemonicArg = (id: string) =>
    executeWithMnemonic(id, 'domain', b => bytesToHex(b))
export const authSecretKeyArg = () =>
    withBackupAuthSecretKey(b => bytesToHex(b))
export const encryptionKeyArg = () =>
    withBackupEncryptionKey(b => bytesToHex(b))
export const itemKeyArg = (id: string) =>
    withBackupItemKey(id, b => bytesToHex(b))
export const mnemonicIndicesArg = () =>
    withBackupMnemonicIndices(b => bytesToHex(b))
export const exportedKeyArg = (id: string) =>
    withExportedKey(id, b => bytesToHex(b))
export const withSecretArg = (id: string) => withSecret(id, b => bytesToHex(b))
export const memberHelper = (id: string) =>
    kms.withSecret(id, b => bytesToHex(b))
export const asyncCallback = (id: string) =>
    withSecret(id, async b => bytesToHex(b))
