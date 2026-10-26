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

import type { Decimal } from 'decimal.js'
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    getCounterpartyTransfers,
    getSentToAddresses,
    type CounterpartyTransfer,
} from './db/repository'
import { hasCachedHistoryRows } from './history-adapter'
import { transferChainAdapters } from './transfer-adapter'

export type AddressPoisoningRisk =
    | { kind: 'lookalike'; similarTo: string }
    | { kind: 'dustOnly' }

export type AddressPoisoningInput = {
    recipient: string
    scope: ChainScope
    /** Every account the user holds on the chain, watch accounts included. */
    ownAddresses: readonly string[]
    /** The accounts the user can sign for: only their payees count as paid before. */
    senders: readonly string[]
    contactAddresses: readonly string[]
}

export type AddressSegment = { text: string; isDifferent: boolean }

const commonPrefixLength = (a: string, b: string): number => {
    let length = 0
    while (length < a.length && a[length] === b[length]) length++
    return length
}

const commonSuffixLength = (a: string, b: string): number => {
    let length = 0
    while (
        length < a.length &&
        length < b.length &&
        a[a.length - 1 - length] === b[b.length - 1 - length]
    ) {
        length++
    }
    return length
}

/**
 * The known address sharing the most leading plus trailing characters with
 * `recipient`, when that reaches `minMatchedChars`. Rule out the recipient
 * itself first: address equality is the chain codec's call, not a string match.
 */
export const findLookalikeAddress = (
    recipient: string,
    knownAddresses: readonly string[],
    minMatchedChars: number,
): Optional<string> => {
    let best: Optional<string>
    let bestScore = minMatchedChars - 1
    for (const known of knownAddresses) {
        const score =
            commonPrefixLength(recipient, known) +
            commonSuffixLength(recipient, known)
        if (score > bestScore) {
            best = known
            bestScore = score
        }
    }
    return best
}

export const isDustOnlyCounterparty = (
    transfers: readonly CounterpartyTransfer[],
    dustCeiling: Decimal,
    isNative: (assetId: Nullable<string>) => boolean,
): boolean =>
    transfers.length > 0 &&
    transfers.every(
        transfer =>
            transfer.direction === 'incoming' &&
            isNative(transfer.assetId) &&
            // An unknown amount is no evidence of dust.
            transfer.amount !== null &&
            transfer.amount.lte(dustCeiling),
    )

/** Characters past the shorter string count as different. */
export const diffAddressCharacters = (
    address: string,
    reference: string,
): AddressSegment[] => {
    const segments: AddressSegment[] = []
    for (let index = 0; index < address.length; index++) {
        const isDifferent = address[index] !== reference[index]
        const last = segments[segments.length - 1]
        if (last && last.isDifferent === isDifferent) {
            last.text += address[index]
        } else {
            segments.push({ text: address[index] ?? '', isDifferent })
        }
    }
    return segments
}

// The screen is a warning, never a gate the send can't pass: an unreadable
// cache falls back to the contact and own-account checks.
const readOrEmpty = async <T>(read: () => Promise<T[]>): Promise<T[]> => {
    try {
        return await read()
    } catch (error) {
        logger.warn('address poisoning: history read failed', { error })
        return []
    }
}

/** Null when the chain screens no recipients, or the recipient shows no sign of poisoning. */
export const assessAddressPoisoning = async ({
    recipient,
    scope,
    ownAddresses,
    senders,
    contactAddresses,
}: AddressPoisoningInput): Promise<Nullable<AddressPoisoningRisk>> => {
    const rules = transferChainAdapters.has(scope.chainId)
        ? transferChainAdapters.get(scope.chainId).addressPoisoning?.()
        : undefined
    if (!rules) return null

    const hasHistory = hasCachedHistoryRows(scope.chainId)
    const sentTo = hasHistory
        ? await readOrEmpty(() => getSentToAddresses({ scope, senders }))
        : []
    const known = [...ownAddresses, ...contactAddresses, ...sentTo]

    const codec = addressCodecs.get(scope.chainId)
    if (known.some(address => codec.areEqual(address, recipient))) return null

    const similarTo = findLookalikeAddress(
        recipient,
        known,
        rules.lookalikeMatchedChars,
    )
    if (similarTo) return { kind: 'lookalike', similarTo }

    if (!hasHistory) return null
    const transfers = await readOrEmpty(() =>
        getCounterpartyTransfers({
            scope,
            ownAddresses,
            counterparty: recipient,
        }),
    )
    const nativeAssetId = getChainDescriptor(scope.chainId).nativeAsset.ref
        .assetId
    const isNative = (assetId: Nullable<string>) =>
        assetId === null || assetId === nativeAssetId
    return isDustOnlyCounterparty(transfers, rules.dustCeiling, isNative)
        ? { kind: 'dustOnly' }
        : null
}
