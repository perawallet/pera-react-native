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

import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import {
    AccountTypes,
    type AccountCredentials,
    type AccountProvenance,
    type WalletAccount,
} from '../models'

export type AccountCustody = {
    provenance: AccountProvenance
    credentials: AccountCredentials
}

/**
 * What a legacy account's `type` and details object describe, or `undefined`
 * when the persisted record lacks what its type requires. This runs on
 * hydration, where a throw would leave the store empty and the next write
 * would persist that, so a malformed record is left alone instead.
 */
export const custodyFromLegacy = (
    account: WalletAccount,
): AccountCustody | undefined => {
    switch (account.type) {
        case AccountTypes.algo25:
        case AccountTypes.quantum: {
            if (!account.keyPairId) return undefined
            return {
                provenance: { kind: 'local', seed: account.type },
                credentials: {
                    [LEGACY_CHAIN_ID]: { keyPairId: account.keyPairId },
                },
            }
        }
        case AccountTypes.hdWallet: {
            if (!account.keyPairId || !account.hdWalletDetails) return undefined
            return {
                provenance: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { ...account.hdWalletDetails },
                },
                credentials: {
                    [LEGACY_CHAIN_ID]: { keyPairId: account.keyPairId },
                },
            }
        }
        case AccountTypes.hardware: {
            if (!account.hardwareDetails) return undefined
            const { accountIndex, ...device } = account.hardwareDetails
            return {
                provenance: { kind: 'hardware', device, accountIndex },
                credentials: {},
            }
        }
        case AccountTypes.multisig: {
            if (!account.multisigDetails) return undefined
            const { threshold, addresses, version } = account.multisigDetails
            return {
                provenance: {
                    kind: 'multisig',
                    threshold,
                    members: [...addresses],
                    version,
                },
                credentials: {},
            }
        }
        case AccountTypes.watch: {
            return { provenance: { kind: 'watch' }, credentials: {} }
        }
        default: {
            return undefined
        }
    }
}

/** Idempotent: an account that already has a provenance is returned as-is. */
export const withCustody = <T extends WalletAccount>(account: T): T => {
    if (account.provenance) return account
    const custody = custodyFromLegacy(account)
    return custody ? { ...account, ...custody } : account
}

/**
 * For writes that may change `type` or its details: custody describing the
 * account as it was is dropped and derived again.
 */
export const rebuildCustody = <T extends WalletAccount>(account: T): T => {
    const custody = custodyFromLegacy(account)
    if (custody) return { ...account, ...custody }
    const rest = { ...account }
    delete rest.provenance
    delete rest.credentials
    return rest
}
