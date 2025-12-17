export const KeyType = {
    HDWalletRootKey: 'hdwallet-root-key',
    HDWalletDerivedKey: 'hdwallet-derived-key',
    DeterministicP256Key: 'deterministic-p256-key',
}

export type KeyType = (typeof KeyType)[keyof typeof KeyType]

export const AccessControlPermission = {
    ReadPublic: 'read-public',
    ReadPrivate: 'read-private',
    Delete: 'delete',
    Refresh: 'refresh',
}

export type AccessControlPermission =
    (typeof AccessControlPermission)[keyof typeof AccessControlPermission]

export type AccessControl = {
    domains: string[]
    permissions: AccessControlPermission[]
}

export type KeyPair = {
    id?: string
    privateDataStorageKey?: string // where the private key information is stored in secure storage
    publicKey: string
    createdAt?: Date
    expiresAt?: Date // optional key expiry. KMD will autodelete keys when accessed after this date
    acl?: AccessControl[] // who can access this key or what can be done with it
    type: KeyType
}
