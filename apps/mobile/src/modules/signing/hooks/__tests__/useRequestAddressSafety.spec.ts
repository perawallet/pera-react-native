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

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    addressCodecs,
    type AddressCodec,
    type ChainId,
    type TransactionNative,
} from '@perawallet/wallet-core-chain-contract'
import type {
    ReviewedAddress,
    ReviewedAddressRole,
} from '@perawallet/wallet-core-signing'
import { useListedAddressesQuery } from '@perawallet/wallet-core-site-safety'
import type { KnownAddress } from '@perawallet/wallet-core-transactions'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import {
    useAddressWarningAcknowledgementStore,
    useRequestAddressSafety,
} from '../useRequestAddressSafety'

const signing = vi.hoisted(() => ({
    currentRequest: undefined as unknown,
    allTransactions: [] as unknown[],
    reviewed: [] as ReviewedAddress[],
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<object>()),
    useSigningRequest: () => ({ currentRequest: signing.currentRequest }),
    useSigningPipeline: () => ({ allTransactions: signing.allTransactions }),
    chainIdOfSignRequest: (request: { chainId: ChainId }) => request.chainId,
    reviewedAddressesOf: (_chainId: ChainId, transaction: TransactionNative) =>
        (transaction as unknown as { reviewed: ReviewedAddress[] }).reviewed,
    resolveAllSignerAddresses: () => [SIGNER],
}))

const known = vi.hoisted(() => ({
    addresses: [] as KnownAddress[],
    params: undefined as unknown,
}))
vi.mock('@modules/transactions', () => ({
    useKnownAddresses: (params: unknown) => {
        known.params = params
        return {
            knownAddresses: known.addresses,
            isPending: true,
            hasSenderHistory: false,
        }
    },
}))

const SIGNER = 'SIGN1111111111111SIGN'
const OWN = 'OWN1AAAAAAAAAAAAOWN1'
const CONTACT = '0xc0n1bbbbbbbbbbbbc0n1'
const LISTED = '0x5cam00000000000005cam'
const STRANGER = 'STR1CCCCCCCCCCCCSTR9'

const lookAlikeOf = (address: string) =>
    `${address.slice(0, 4)}ZZZZZZZZZZZZ${address.slice(-4)}`

const shortForm = (address: string) =>
    `${address.slice(0, 4)}...${address.slice(-4)}`

const fakeCodec = (chainId: ChainId): AddressCodec => {
    const areEqual = (a: string, b: string) =>
        a.toLowerCase() === b.toLowerCase()
    return {
        chainId,
        fromPublicKey: () => '',
        isValid: () => true,
        normalize: address => address,
        areEqual,
        truncate: shortForm,
        resembles: (a, b) =>
            !areEqual(a, b) &&
            shortForm(a).toLowerCase() === shortForm(b).toLowerCase(),
        toPaymentUri: address => address,
        parsePaymentUri: () => undefined,
    }
}

const ROLES: ReviewedAddressRole[] = [
    'recipient',
    'token-recipient',
    'close-recipient',
    'new-authorizer',
    'referenced-account',
    'target',
    'spender',
    'operator',
]

const requestOn = (
    chainId: ChainId,
    reviewed: ReviewedAddress[][],
    { id = 'request-1', sourceType = 'walletconnect' } = {},
) => {
    signing.currentRequest = { id, chainId, sourceType }
    signing.allTransactions = reviewed.map(addresses => ({
        family: chainId === 'algorand' ? 'algorand' : 'evm',
        reviewed: addresses,
    }))
}

describe('useRequestAddressSafety', () => {
    beforeEach(() => {
        registerEthereumChain()
        addressCodecs.reset()
        addressCodecs.register(fakeCodec('algorand'))
        addressCodecs.register(fakeCodec('ethereum'))
        useAddressWarningAcknowledgementStore.getState().resetState()
        known.addresses = [
            { address: OWN, source: 'own-account', name: 'Main' },
            { address: CONTACT, source: 'contact', name: 'Alice' },
        ]
        vi.mocked(useListedAddressesQuery).mockImplementation(() => ({
            isListed: address => address.toLowerCase() === LISTED,
            isChecking: false,
        }))
    })

    afterEach(() => {
        addressCodecs.reset()
    })

    it.each(ROLES)('flags a listed %s and holds Confirm', role => {
        requestOn('ethereum', [[{ address: LISTED, role }]])

        const { result } = renderHook(() => useRequestAddressSafety())

        expect(result.current.flaggedAddresses).toEqual([
            { address: LISTED, role, assessment: { kind: 'listed' } },
        ])
        expect(result.current.isConfirmBlocked).toBe(true)
    })

    it.each(ROLES)('flags a %s imitating an own account on Algorand', role => {
        requestOn('algorand', [[{ address: lookAlikeOf(OWN), role }]])

        const { result } = renderHook(() => useRequestAddressSafety())

        expect(result.current.flaggedAddresses).toEqual([
            {
                address: lookAlikeOf(OWN),
                role,
                assessment: {
                    kind: 'look-alike',
                    knownAddress: known.addresses[0],
                },
            },
        ])
    })

    it.each(ROLES)('flags a %s imitating a contact on EVM', role => {
        requestOn('ethereum', [[{ address: lookAlikeOf(CONTACT), role }]])

        const { result } = renderHook(() => useRequestAddressSafety())

        expect(result.current.flaggedAddresses[0]).toMatchObject({
            role,
            assessment: {
                kind: 'look-alike',
                knownAddress: known.addresses[1],
            },
        })
    })

    it('releases Confirm once the user acknowledges the warning', () => {
        requestOn('ethereum', [[{ address: LISTED, role: 'spender' }]])
        const { result } = renderHook(() => useRequestAddressSafety())

        act(() => result.current.toggleAcknowledged())

        expect(result.current.isAcknowledged).toBe(true)
        expect(result.current.isConfirmBlocked).toBe(false)
    })

    it('flags nothing and holds nothing for a contract on no list that resembles nothing', () => {
        requestOn('ethereum', [[{ address: STRANGER, role: 'target' }]])

        const { result } = renderHook(() => useRequestAddressSafety())

        expect(result.current.flaggedAddresses).toEqual([])
        expect(result.current.isConfirmBlocked).toBe(false)
    })

    it('leaves a request the wallet built to its own send checks', () => {
        requestOn('ethereum', [[{ address: LISTED, role: 'recipient' }]], {
            sourceType: 'local',
        })

        const { result } = renderHook(() => useRequestAddressSafety())

        expect(result.current.flaggedAddresses).toEqual([])
        expect(result.current.isConfirmBlocked).toBe(false)
        expect(known.params).toMatchObject({ isEnabled: false })
    })

    it('does not wait on the signer’s history, which may need the network', () => {
        requestOn('algorand', [
            [{ address: lookAlikeOf(OWN), role: 'recipient' }],
        ])

        const { result } = renderHook(() => useRequestAddressSafety())

        expect(known.params).toMatchObject({
            senderAddress: SIGNER,
            isEnabled: true,
            isSenderHistoryOnly: true,
        })
        expect(result.current.flaggedAddresses).toHaveLength(1)
        expect(result.current.isChecking).toBe(false)
    })

    it('holds Confirm while the lists are still being read', () => {
        vi.mocked(useListedAddressesQuery).mockReturnValue({
            isListed: () => false,
            isChecking: true,
        })
        requestOn('ethereum', [[{ address: STRANGER, role: 'target' }]])

        const { result } = renderHook(() => useRequestAddressSafety())

        expect(result.current.isConfirmBlocked).toBe(true)
    })

    it('starts the next request unacknowledged', () => {
        requestOn('ethereum', [[{ address: LISTED, role: 'spender' }]])
        const { result, rerender } = renderHook(() => useRequestAddressSafety())
        act(() => result.current.toggleAcknowledged())

        requestOn('ethereum', [[{ address: LISTED, role: 'spender' }]], {
            id: 'request-2',
        })
        rerender()

        expect(result.current.isAcknowledged).toBe(false)
        expect(result.current.isConfirmBlocked).toBe(true)
    })

    it('flags an address once however many roles and transactions name it', () => {
        requestOn('ethereum', [
            [
                { address: LISTED, role: 'spender' },
                { address: LISTED.toUpperCase(), role: 'target' },
            ],
            [{ address: LISTED, role: 'recipient' }],
        ])

        const { result } = renderHook(() => useRequestAddressSafety())

        expect(result.current.flaggedAddresses).toEqual([
            {
                address: LISTED,
                role: 'spender',
                assessment: { kind: 'listed' },
            },
        ])
    })

    it('checks the addresses it is given instead of the transactions', () => {
        requestOn('ethereum', [[{ address: STRANGER, role: 'target' }]])

        const { result } = renderHook(() =>
            useRequestAddressSafety({
                addresses: [{ address: LISTED, role: 'spender' }],
            }),
        )

        expect(result.current.flaggedAddresses).toEqual([
            {
                address: LISTED,
                role: 'spender',
                assessment: { kind: 'listed' },
            },
        ])
    })
})
