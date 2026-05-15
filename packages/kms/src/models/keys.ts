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

/**
 * Deterministic keystore id for the Ed25519 signing child of an Algo25 seed.
 * One child per seed is created at seed-commit time; signing/lookup always
 * hits this id, so accounts never need to track it separately.
 */
export const algo25SignKeyId = (seedId: string): string => `${seedId}-ed25519`
