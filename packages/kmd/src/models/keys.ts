/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

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
