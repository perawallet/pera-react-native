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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
    type AddressCodec,
} from '@perawallet/wallet-core-chain-contract'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    assessAddressPoisoning,
    diffAddressCharacters,
    findLookalikeAddress,
    isDustOnlyCounterparty,
    type AddressPoisoningInput,
} from '../address-poisoning'
import { transferChainAdapters } from '../transfer-adapter'
import { historyChainAdapters } from '../history-adapter'
import { fixtureHistoryAdapter } from './fixture-chain-data'
import { getCounterpartyTransfers, getSentToAddresses } from '../db/repository'
import type { CounterpartyTransfer } from '../db/repository'

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: () => ({ nativeAsset: { ref: { assetId: '0' } } }),
}))

vi.mock('../db/repository', async importOriginal => ({
    ...(await importOriginal<typeof import('../db/repository')>()),
    getSentToAddresses: vi.fn(),
    getCounterpartyTransfers: vi.fn(),
}))

const SCOPE = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const
const DUST_CEILING = new Decimal(1000)
const isNative = (assetId: Nullable<string>) =>
    assetId === null || assetId === '0'

const pad = (head: string, tail: string, filler = 'Q') =>
    `${head}${filler.repeat(20 - head.length - tail.length)}${tail}`

const KNOWN = pad('ABCD', 'WXYZ', 'K')

const incoming = (amount: number, assetId: Nullable<string> = null) =>
    ({
        direction: 'incoming',
        assetId,
        amount: new Decimal(amount),
    }) satisfies CounterpartyTransfer

describe('findLookalikeAddress', () => {
    it('flags an address sharing the first four characters', () => {
        const recipient = pad('ABCD', 'MNOP')

        expect(findLookalikeAddress(recipient, [KNOWN], 4)).toBe(KNOWN)
    })

    it('flags an address sharing the last four characters', () => {
        const recipient = pad('MNOP', 'WXYZ')

        expect(findLookalikeAddress(recipient, [KNOWN], 4)).toBe(KNOWN)
    })

    it('flags an address sharing two leading and two trailing characters', () => {
        const recipient = pad('ABMN', 'OPYZ')

        expect(findLookalikeAddress(recipient, [KNOWN], 4)).toBe(KNOWN)
    })

    it('ignores an address sharing only three characters in total', () => {
        const recipient = pad('ABMN', 'OPQZ')

        expect(findLookalikeAddress(recipient, [KNOWN], 4)).toBeUndefined()
    })

    it('picks the known address sharing the most characters', () => {
        const weaker = pad('ABCD', 'MNOP', 'R')
        const stronger = pad('ABCDE', 'STUV', 'R')
        const recipient = pad('ABCDE', 'GHIJ')

        expect(findLookalikeAddress(recipient, [weaker, stronger], 4)).toBe(
            stronger,
        )
    })
})

describe('isDustOnlyCounterparty', () => {
    it('is false with no transfers', () => {
        expect(isDustOnlyCounterparty([], DUST_CEILING, isNative)).toBe(false)
    })

    it('is true for tiny and zero incoming native transfers', () => {
        expect(
            isDustOnlyCounterparty(
                [incoming(1), incoming(14), incoming(0)],
                DUST_CEILING,
                isNative,
            ),
        ).toBe(true)
    })

    it('counts a transfer at the ceiling as dust', () => {
        expect(
            isDustOnlyCounterparty([incoming(1000)], DUST_CEILING, isNative),
        ).toBe(true)
    })

    it('is false once the user has sent to the address', () => {
        const outgoing: CounterpartyTransfer = {
            direction: 'outgoing',
            assetId: null,
            amount: new Decimal(1),
        }

        expect(
            isDustOnlyCounterparty(
                [incoming(1), outgoing],
                DUST_CEILING,
                isNative,
            ),
        ).toBe(false)
    })

    it('is false for an incoming transfer above the ceiling', () => {
        expect(
            isDustOnlyCounterparty(
                [incoming(1), incoming(1001)],
                DUST_CEILING,
                isNative,
            ),
        ).toBe(false)
    })

    it('is false for an incoming transfer of another asset', () => {
        expect(
            isDustOnlyCounterparty(
                [incoming(1, '31566704')],
                DUST_CEILING,
                isNative,
            ),
        ).toBe(false)
    })

    it('does not count a transfer with no amount as dust', () => {
        const noAmount: CounterpartyTransfer = {
            direction: 'incoming',
            assetId: null,
            amount: null,
        }

        expect(
            isDustOnlyCounterparty(
                [incoming(1), noAmount],
                DUST_CEILING,
                isNative,
            ),
        ).toBe(false)
    })
})

describe('diffAddressCharacters', () => {
    it('groups matching and differing characters into runs', () => {
        expect(diffAddressCharacters('ABCDEF', 'ABXYEF')).toEqual([
            { text: 'AB', isDifferent: false },
            { text: 'CD', isDifferent: true },
            { text: 'EF', isDifferent: false },
        ])
    })

    it('marks characters past the reference as different', () => {
        expect(diffAddressCharacters('ABCD', 'AB')).toEqual([
            { text: 'AB', isDifferent: false },
            { text: 'CD', isDifferent: true },
        ])
    })

    it('returns one matching run for identical addresses', () => {
        expect(diffAddressCharacters('ABCD', 'ABCD')).toEqual([
            { text: 'ABCD', isDifferent: false },
        ])
    })
})

describe('assessAddressPoisoning', () => {
    const OWN = pad('OWNA', 'OWNZ', 'O')
    const CONTACT = pad('CONT', 'ACTZ', 'C')
    const SENT_TO = pad('SENT', 'TOZZ', 'S')
    const WATCHED = pad('WTCH', 'WTCZ', 'W')

    const input = (
        recipient: string,
        overrides: Partial<AddressPoisoningInput> = {},
    ): AddressPoisoningInput => ({
        recipient,
        scope: SCOPE,
        ownAddresses: [OWN, WATCHED],
        senders: [OWN],
        contactAddresses: [CONTACT],
        ...overrides,
    })

    const registerTransferAdapter = (withRules: boolean) => {
        transferChainAdapters.reset()
        transferChainAdapters.register({
            chainId: SCOPE.chainId,
            build: vi.fn(),
            getFeeEstimate: vi.fn(),
            spendableBalance: vi.fn(),
            ...(withRules
                ? {
                      addressPoisoning: () => ({
                          lookalikeMatchedChars: 4,
                          dustCeiling: DUST_CEILING,
                      }),
                  }
                : {}),
        })
    }

    beforeEach(() => {
        vi.mocked(getSentToAddresses).mockResolvedValue([SENT_TO])
        vi.mocked(getCounterpartyTransfers).mockResolvedValue([])
        registerTransferAdapter(true)
        historyChainAdapters.register(fixtureHistoryAdapter())
        addressCodecs.register({
            chainId: SCOPE.chainId,
            areEqual: (a: string, b: string) => a === b,
        } as AddressCodec)
    })

    afterEach(() => {
        vi.clearAllMocks()
        transferChainAdapters.reset()
        historyChainAdapters.reset()
        addressCodecs.reset()
    })

    it('screens nothing on a chain with no rules', async () => {
        registerTransferAdapter(false)

        const risk = await assessAddressPoisoning(input(pad('CONT', 'XXXX')))

        expect(risk).toBeNull()
    })

    it.each([
        ['own account', OWN],
        ['contact', CONTACT],
        ['sent-to address', SENT_TO],
    ])('lets an exact %s through even when it sent dust', async (_, known) => {
        vi.mocked(getCounterpartyTransfers).mockResolvedValue([incoming(1)])

        const risk = await assessAddressPoisoning(input(known))

        expect(risk).toBeNull()
    })

    it.each([
        ['own account', OWN, pad('OWNA', 'MMMM')],
        ['contact', CONTACT, pad('CONT', 'MMMM')],
        ['sent-to address', SENT_TO, pad('SENT', 'MMMM')],
    ])('flags a look-alike of a %s', async (_, known, recipient) => {
        const risk = await assessAddressPoisoning(input(recipient))

        expect(risk).toEqual({ kind: 'lookalike', similarTo: known })
    })

    it('flags an address that only sent the user dust', async () => {
        vi.mocked(getCounterpartyTransfers).mockResolvedValue([
            incoming(1),
            incoming(14),
        ])

        const risk = await assessAddressPoisoning(input(pad('MMMM', 'NNNN')))

        expect(risk).toEqual({ kind: 'dustOnly' })
        expect(getCounterpartyTransfers).toHaveBeenCalledWith({
            scope: SCOPE,
            ownAddresses: [OWN, WATCHED],
            counterparty: pad('MMMM', 'NNNN'),
        })
    })

    it('reports the look-alike when the address also sent dust', async () => {
        vi.mocked(getCounterpartyTransfers).mockResolvedValue([incoming(1)])

        const risk = await assessAddressPoisoning(input(pad('CONT', 'MMMM')))

        expect(risk).toEqual({ kind: 'lookalike', similarTo: CONTACT })
    })

    it("reads the paid-before list from the user's signing accounts only", async () => {
        await assessAddressPoisoning(input(pad('MMMM', 'NNNN')))

        expect(getSentToAddresses).toHaveBeenCalledWith({
            scope: SCOPE,
            senders: [OWN],
        })
    })

    it('lets an unknown address with no history through', async () => {
        const risk = await assessAddressPoisoning(input(pad('MMMM', 'NNNN')))

        expect(risk).toBeNull()
    })

    it('still checks contacts when the history read fails', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        vi.mocked(getSentToAddresses).mockRejectedValue(new Error('db'))
        vi.mocked(getCounterpartyTransfers).mockRejectedValue(new Error('db'))

        const risk = await assessAddressPoisoning(input(pad('CONT', 'MMMM')))

        expect(risk).toEqual({ kind: 'lookalike', similarTo: CONTACT })
        expect(warn).toHaveBeenCalled()
    })

    it('skips the history on a chain that caches no rows', async () => {
        historyChainAdapters.reset()
        vi.mocked(getCounterpartyTransfers).mockResolvedValue([incoming(1)])

        const risk = await assessAddressPoisoning(input(pad('MMMM', 'NNNN')))

        expect(risk).toBeNull()
        expect(getSentToAddresses).not.toHaveBeenCalled()
    })
})
