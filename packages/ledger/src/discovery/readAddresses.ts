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
import { hasLedgerAppDriver } from '@perawallet/wallet-core-hardware-wallet'
import type {
    LedgerTransport,
    LedgerTransportProvider,
} from '@perawallet/wallet-extension-ledger-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { withLedgerConnectionTimeout } from './ledgerTimeouts'

/**
 * The first of `chainIds` whose device app can read an address back for
 * comparison: a Ledger app driver serves it and an address codec compares it.
 */
export const ledgerReadableChainOf = (
    chainIds: readonly ChainId[],
): Optional<ChainId> =>
    chainIds.find(
        chainId => hasLedgerAppDriver(chainId) && addressCodecs.has(chainId),
    )

export type ReadLedgerAddressesOptions = {
    provider: LedgerTransportProvider
    deviceId: string
    /** The chain whose device app the read speaks. */
    chainId: ChainId
    accountIndices: readonly number[]
}

/**
 * The device's address at each of `accountIndices` in `chainId`'s app, read
 * without showing it on the device. The link is released before this settles,
 * including a transport that arrives after the connect timed out.
 */
export const readLedgerAddresses = async ({
    provider,
    deviceId,
    chainId,
    accountIndices,
}: ReadLedgerAddressesOptions): Promise<Map<number, string>> => {
    const connectPromise = provider.connect(deviceId, chainId)
    let transport: LedgerTransport
    try {
        transport = await withLedgerConnectionTimeout(
            connectPromise,
            'Connect to Ledger',
        )
    } catch (error) {
        connectPromise
            .then(late => late.disconnect().catch(() => undefined))
            .catch(() => undefined)
        throw error
    }
    try {
        const addresses = new Map<number, string>()
        for (const accountIndex of new Set(accountIndices)) {
            const { address } = await withLedgerConnectionTimeout(
                transport.getAddress(accountIndex, false),
                'Read Ledger address',
            )
            addresses.set(accountIndex, address)
        }
        return addresses
    } finally {
        await transport.disconnect().catch(() => undefined)
    }
}
