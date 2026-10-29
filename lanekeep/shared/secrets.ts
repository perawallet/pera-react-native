/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

// Calls that return key material. A rule is blind to a producer missing
// here. Callback-style `pbkdf2` can't be listed (its key arrives as a callback
// parameter, which lanekeep doesn't track), so its promise wrappers are.
export const SECRET_PRODUCERS: readonly string[] = [
    'algo25SecretKeyToIndices',
    'algo25SeedToIndices',
    'argon2id',
    'argon2idDerive',
    'backupMnemonicToPassword',
    'bip39SeedFromEntropy',
    'computeArgon2id',
    'decodePrivateKey',
    'decodePrivateKeyBytes',
    'deriveArgon2id',
    'deriveBackupAuthKeypair',
    'deriveBackupChildKeys',
    'deriveBackupKeys',
    'deriveBackupMasterKey',
    'deriveBip39Seed',
    'deriveLegacyPasskeyCredentialFromMainKey',
    'deriveLiquidAuthMainKey',
    'deriveMainKey',
    'derivePasskeyCredential',
    'derivePasskeyMainKey',
    'derivePQKeygenSeed',
    'deriveSecp256k1PrivateKey',
    'entropyToIndices',
    'fromSeed',
    'genDerivedMainKeyWithSubtle',
    'genDomainSpecificKeyPair',
    'generateHDMasterKey',
    'generateKeypairFromSeed',
    'hashPin',
    'hkdf',
    'indicesToAlgo25Seed',
    'indicesToEntropy',
    'indicesToUtf8Bytes',
    'mnemonicWordsToIndices',
    'prepareHDMasterKey',
    'requireSessionMasterKey',
    'unwrapMasterKeyWithPassword',
    'utf8BytesToIndices',
    // bip39/algosdk calls with no production caller, listed so a new one is checked.
    'mnemonicToEntropy',
    'mnemonicToSeed',
    'seedFromMnemonic',
]

// Helpers that hand their callback a secret and zero it afterwards. A helper
// missing here is blind to its callback parameter. `executeWithKey` has no
// definition today and is listed so a new one is checked.
export const SCOPED_SECRET_HELPERS: readonly string[] = [
    'executeWithKey',
    'executeWithMnemonic',
    'withBackupAuthSecretKey',
    'withBackupEncryptionKey',
    'withBackupItemKey',
    'withBackupMnemonicIndices',
    'withExportedKey',
    'withSecret',
]
