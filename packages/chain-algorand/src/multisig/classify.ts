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

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    ParticipantVerdicts,
    type ParticipantVerdict,
} from '@perawallet/wallet-core-multisig'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getAlgorandClient } from '../blockchain/utils/algorandClient'

export const AccountSigTypes = {
    sig: 'sig',
    msig: 'msig',
    lsig: 'lsig',
    pqsig: 'pqsig',
} as const

export type AccountSigType =
    (typeof AccountSigTypes)[keyof typeof AccountSigTypes]

const isKnownSigType = (value: unknown): value is AccountSigType =>
    typeof value === 'string' && value in AccountSigTypes

const isNotFoundError = (error: unknown): boolean =>
    error instanceof Error &&
    'status' in error &&
    (error as { status: unknown }).status === 404

/**
 * The signature scheme an address uses, as observed by the indexer. `null`
 * means unknown, not Ed25519: the indexer derives sig-type from the account's
 * signing history, so an address that never appeared on chain (404) or never
 * signed cannot be classified.
 */
export const fetchAccountSigType = async (
    algokit: AlgorandClient,
    address: string,
): Promise<Nullable<AccountSigType>> => {
    try {
        const response = await algokit.client.indexer
            .lookupAccountByID(address)
            .exclude('all')
            .do()
        const sigType = response.account.sigType
        return isKnownSigType(sigType) ? sigType : null
    } catch (error) {
        if (isNotFoundError(error)) return null
        throw error
    }
}

// A post-quantum address is a hash of the PQ key, indistinguishable from an
// Ed25519 address offline, so only the indexer's observed sig-type can tell.
export const classifyAlgorandParticipant = async (
    address: string,
    scope: ChainScope,
): Promise<ParticipantVerdict> => {
    const sigType = await fetchAccountSigType(getAlgorandClient(scope), address)
    if (sigType === null) return ParticipantVerdicts.unclassified
    return sigType === AccountSigTypes.pqsig
        ? ParticipantVerdicts.incompatibleScheme
        : ParticipantVerdicts.eligible
}
