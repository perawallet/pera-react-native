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
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { LedgerTransportProvider } from '@perawallet/wallet-extension-ledger-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { ledgerReadableChainOf, readLedgerAddresses } from './readAddresses'

/** An account already at a Ledger device position, as a proof needs it. */
export type LedgerHolder = {
    id: string
    accountIndex: number
    /** The account's address on each chain it holds. */
    addresses: Partial<Record<ChainId, string>>
}

/** The device read that would prove `holderId` holds the connected device's seed. */
export type LedgerHolderClaim = {
    holderId: string
    chainId: ChainId
    accountIndex: number
    address: string
}

/**
 * The read proving `holder`: its address on the first chain it holds whose
 * device app can read one back. Undefined when no such chain exists.
 */
export const ledgerHolderClaim = (
    holder: LedgerHolder,
): Optional<LedgerHolderClaim> => {
    const held = (Object.keys(holder.addresses) as ChainId[]).filter(
        chainId => holder.addresses[chainId] !== undefined,
    )
    const chainId = ledgerReadableChainOf(held)
    const address = chainId && holder.addresses[chainId]
    return chainId && address
        ? {
              holderId: holder.id,
              chainId,
              accountIndex: holder.accountIndex,
              address,
          }
        : undefined
}

/**
 * Whether an address the device has already verified at the claim's index
 * proves it. Chains sharing a device app (every EVM chain uses the Ethereum
 * app) derive the same address there, so no second read is needed.
 */
export const isLedgerClaimMetBy = (
    claim: LedgerHolderClaim,
    verifiedAddress: string,
): boolean => {
    const codec = addressCodecs.get(claim.chainId)
    return (
        codec.isValid(verifiedAddress) &&
        codec.areEqual(claim.address, verifiedAddress)
    )
}

/** `claims` by the chain whose app reads them, in first-seen order. */
export const ledgerClaimsByChain = (
    claims: readonly LedgerHolderClaim[],
): Map<ChainId, LedgerHolderClaim[]> => {
    const byChain = new Map<ChainId, LedgerHolderClaim[]>()
    for (const claim of claims) {
        byChain.set(claim.chainId, [
            ...(byChain.get(claim.chainId) ?? []),
            claim,
        ])
    }
    return byChain
}

export type ProveLedgerHoldersOptions = {
    provider: LedgerTransportProvider
    deviceId: string
    /** The chain whose app reads `claims`; every claim is on it. */
    chainId: ChainId
    claims: readonly LedgerHolderClaim[]
}

/**
 * The holders whose address the device reads back at their index in
 * `chainId`'s app. Rejects as `readLedgerAddresses` does.
 */
export const proveLedgerHolders = async ({
    provider,
    deviceId,
    chainId,
    claims,
}: ProveLedgerHoldersOptions): Promise<Set<string>> => {
    const read = await readLedgerAddresses({
        provider,
        deviceId,
        chainId,
        accountIndices: claims.map(claim => claim.accountIndex),
    })
    const codec = addressCodecs.get(chainId)
    return new Set(
        claims
            .filter(claim => {
                const address = read.get(claim.accountIndex)
                return (
                    address !== undefined &&
                    codec.areEqual(address, claim.address)
                )
            })
            .map(claim => claim.holderId),
    )
}
