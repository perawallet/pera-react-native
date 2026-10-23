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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import type {
    LedgerTransport,
    LedgerTransportProvider,
} from '@perawallet/wallet-extension-ledger-shared'
import {
    isLedgerClaimMetBy,
    ledgerClaimsByChain,
    ledgerHolderClaim,
    proveLedgerHolders,
    type LedgerHolderClaim,
} from '../proveHolders'

vi.mock('@perawallet/wallet-core-hardware-wallet', () => ({
    hasLedgerAppDriver: (chainId: string) =>
        ['algorand', 'ethereum', 'base'].includes(chainId),
}))

const evmCodec = (chainId: string) =>
    ({
        chainId,
        isValid: (address: string) => /^0x[0-9a-f]{40}$/i.test(address),
        areEqual: (a: string, b: string) => a.toLowerCase() === b.toLowerCase(),
    }) as never

const EVM_ADDRESS = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'

const claim = (
    holderId: string,
    chainId: string,
    accountIndex: number,
    address: string,
): LedgerHolderClaim => ({ holderId, chainId, accountIndex, address })

const providerReading = (
    addressAt: (accountIndex: number) => string,
): LedgerTransportProvider =>
    ({
        connect: vi.fn(
            async () =>
                ({
                    getAddress: vi.fn(async (accountIndex: number) => ({
                        address: addressAt(accountIndex),
                        publicKey: new Uint8Array(32),
                        accountIndex,
                    })),
                    disconnect: vi.fn(async () => {}),
                }) as unknown as LedgerTransport,
        ),
    }) as unknown as LedgerTransportProvider

beforeEach(() => {
    addressCodecs.reset()
    addressCodecs.register({
        chainId: 'algorand',
        isValid: (address: string) => /^[A-Z2-7]{58}$/.test(address),
        areEqual: (a: string, b: string) => a === b,
    } as never)
    addressCodecs.register(evmCodec('ethereum'))
    addressCodecs.register(evmCodec('base'))
})

describe('ledgerHolderClaim', () => {
    it('claims the first readable chain the holder holds', () => {
        expect(
            ledgerHolderClaim({
                id: 'ledger',
                accountIndex: 2,
                addresses: { polygon: EVM_ADDRESS, ethereum: EVM_ADDRESS },
            }),
        ).toEqual(claim('ledger', 'ethereum', 2, EVM_ADDRESS))
    })

    it('makes no claim when the holder holds no readable chain', () => {
        expect(
            ledgerHolderClaim({
                id: 'ledger',
                accountIndex: 0,
                addresses: { polygon: EVM_ADDRESS },
            }),
        ).toBeUndefined()
    })
})

describe('isLedgerClaimMetBy', () => {
    it("is met by the same address verified in another EVM chain's app", () => {
        expect(
            isLedgerClaimMetBy(
                claim('ledger', 'ethereum', 0, EVM_ADDRESS),
                EVM_ADDRESS.toLowerCase(),
            ),
        ).toBe(true)
    })

    it('is not met by an address on another chain family', () => {
        expect(
            isLedgerClaimMetBy(
                claim('ledger', 'algorand', 0, 'A'.repeat(58)),
                EVM_ADDRESS,
            ),
        ).toBe(false)
    })

    it('is not met by another EVM address', () => {
        expect(
            isLedgerClaimMetBy(
                claim('ledger', 'ethereum', 0, EVM_ADDRESS),
                `0x${'1'.repeat(40)}`,
            ),
        ).toBe(false)
    })
})

describe('ledgerClaimsByChain', () => {
    it('groups claims by chain in first-seen order', () => {
        const a = claim('a', 'algorand', 0, 'A'.repeat(58))
        const b = claim('b', 'ethereum', 1, EVM_ADDRESS)
        const c = claim('c', 'algorand', 2, 'C'.repeat(58))

        expect([...ledgerClaimsByChain([a, b, c])]).toEqual([
            ['algorand', [a, c]],
            ['ethereum', [b]],
        ])
    })
})

describe('proveLedgerHolders', () => {
    it("proves the holders whose address the chain's app reads back at their index", async () => {
        const provider = providerReading(index =>
            index === 0 ? 'A'.repeat(58) : 'X'.repeat(58),
        )

        const proven = await proveLedgerHolders({
            provider,
            deviceId: 'device',
            chainId: 'algorand',
            claims: [
                claim('same-seed', 'algorand', 0, 'A'.repeat(58)),
                claim('other-seed', 'algorand', 1, 'B'.repeat(58)),
            ],
        })

        expect(provider.connect).toHaveBeenCalledWith('device', 'algorand')
        expect([...proven]).toEqual(['same-seed'])
    })

    it('compares through the chain codec', async () => {
        const proven = await proveLedgerHolders({
            provider: providerReading(() => EVM_ADDRESS.toLowerCase()),
            deviceId: 'device',
            chainId: 'ethereum',
            claims: [claim('ledger', 'ethereum', 0, EVM_ADDRESS)],
        })

        expect([...proven]).toEqual(['ledger'])
    })

    it('rejects when the read fails', async () => {
        const failure = new Error('CLA_NOT_SUPPORTED')
        const provider = {
            connect: vi.fn(async () => {
                throw failure
            }),
        } as unknown as LedgerTransportProvider

        await expect(
            proveLedgerHolders({
                provider,
                deviceId: 'device',
                chainId: 'algorand',
                claims: [claim('ledger', 'algorand', 0, 'A'.repeat(58))],
            }),
        ).rejects.toBe(failure)
    })
})
