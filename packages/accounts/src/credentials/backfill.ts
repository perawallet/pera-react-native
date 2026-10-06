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
    type AccountChains,
    type AccountCustody,
    type WalletAccount,
} from '../models'

export type CustodyFields = {
    custody: AccountCustody
    chains: AccountChains
}

/**
 * What a legacy account's `type` and details object describe, or `undefined`
 * when the persisted record lacks what its type requires. This runs on
 * hydration, where a throw would leave the store empty and the next write
 * would persist that, so a malformed record is left alone instead.
 */
export const custodyFromLegacy = (
    account: WalletAccount,
): CustodyFields | undefined => {
    const { address } = account
    switch (account.type) {
        case AccountTypes.algo25:
        case AccountTypes.quantum: {
            if (!account.keyPairId) return undefined
            return {
                custody: { kind: 'local', seed: account.type },
                chains: {
                    [LEGACY_CHAIN_ID]: {
                        address,
                        keyPairId: account.keyPairId,
                    },
                },
            }
        }
        case AccountTypes.hdWallet: {
            if (!account.keyPairId || !account.hdWalletDetails) return undefined
            const { account: hdAccount, keyIndex } = account.hdWalletDetails
            return {
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: hdAccount, keyIndex },
                },
                chains: {
                    [LEGACY_CHAIN_ID]: {
                        address,
                        keyPairId: account.keyPairId,
                    },
                },
            }
        }
        case AccountTypes.hardware: {
            if (!account.hardwareDetails) return undefined
            const { accountIndex, ...device } = account.hardwareDetails
            return {
                custody: { kind: 'hardware', device, accountIndex },
                chains: { [LEGACY_CHAIN_ID]: { address } },
            }
        }
        case AccountTypes.multisig: {
            if (!account.multisigDetails) return undefined
            const { threshold, addresses, version } = account.multisigDetails
            return {
                custody: { kind: 'multisig' },
                chains: {
                    [LEGACY_CHAIN_ID]: {
                        address,
                        native: {
                            family: 'algorand',
                            multisig: {
                                version,
                                threshold,
                                addresses: [...addresses],
                            },
                        },
                    },
                },
            }
        }
        case AccountTypes.watch: {
            return {
                custody: { kind: 'watch' },
                chains: { [LEGACY_CHAIN_ID]: { address } },
            }
        }
        default: {
            return undefined
        }
    }
}

/** Idempotent: an account that already has a custody is returned as-is. */
export const withCustody = <T extends WalletAccount>(account: T): T => {
    if (account.custody) return account
    const fields = custodyFromLegacy(account)
    return fields ? { ...account, ...fields } : account
}

/**
 * For writes that may change `type` or its details: custody describing the
 * account as it was is dropped and derived again.
 */
export const rebuildCustody = <T extends WalletAccount>(account: T): T => {
    const fields = custodyFromLegacy(account)
    if (fields) return { ...account, ...fields }
    const rest = { ...account }
    delete rest.custody
    delete rest.chains
    return rest
}
