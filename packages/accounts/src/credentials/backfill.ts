/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    AccountTypes,
    type AccountCredential,
    type WalletAccount,
} from '../models'

/**
 * The credentials a legacy account's `type` and details object describe, or
 * `undefined` when the persisted record lacks what its type requires. This runs
 * on hydration, where a throw would leave the store empty and the next write
 * would persist that, so a malformed record is left alone instead.
 */
export const credentialsFromLegacy = (
    account: WalletAccount,
): AccountCredential[] | undefined => {
    switch (account.type) {
        case AccountTypes.algo25:
        case AccountTypes.quantum: {
            if (!account.keyPairId) return undefined
            return [
                {
                    kind: 'local',
                    keyPairId: account.keyPairId,
                    provenance: account.type,
                },
            ]
        }
        case AccountTypes.hdWallet: {
            if (!account.keyPairId || !account.hdWalletDetails) return undefined
            return [
                {
                    kind: 'local',
                    keyPairId: account.keyPairId,
                    provenance: 'bip39',
                    hd: { ...account.hdWalletDetails },
                },
            ]
        }
        case AccountTypes.hardware: {
            if (!account.hardwareDetails) return undefined
            const { accountIndex, ...device } = account.hardwareDetails
            return [{ kind: 'hardware', device, accountIndex }]
        }
        case AccountTypes.multisig: {
            if (!account.multisigDetails) return undefined
            const { threshold, addresses, version } = account.multisigDetails
            return [
                {
                    kind: 'multisig',
                    threshold,
                    members: [...addresses],
                    version,
                },
            ]
        }
        case AccountTypes.watch: {
            return [{ kind: 'watch' }]
        }
        default: {
            return undefined
        }
    }
}

/** Idempotent: an account that already carries credentials is returned as-is. */
export const withCredentials = <T extends WalletAccount>(account: T): T => {
    if (account.credentials) return account
    const credentials = credentialsFromLegacy(account)
    return credentials ? { ...account, credentials } : account
}

/**
 * For writes that may change `type` or its details: credentials describing the
 * account as it was are dropped and derived again.
 */
export const rebuildCredentials = <T extends WalletAccount>(account: T): T => {
    const credentials = credentialsFromLegacy(account)
    if (credentials) return { ...account, credentials }
    const rest = { ...account }
    delete rest.credentials
    return rest
}
