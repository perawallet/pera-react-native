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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import {
    messageSignerChainAdapters,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import { algorandMessageSignerAdapter } from '@perawallet/wallet-core-chain-algorand/signing'
import { registerAlgorandReviewerAdapter } from '@test-utils/reviewerChainAdapter'
import { useIsDataSigningBlocked } from '../useIsDataSigningBlocked'

type TestAccount = {
    custody: { kind: string }
    chains: Record<string, { address: string }>
}

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
    hasCustody: (account: TestAccount, kind: string) =>
        account.custody.kind === kind,
    findAccountByAddressOn: (
        accounts: TestAccount[],
        chainId: string,
        address: string,
    ) => accounts.find(a => a.chains[chainId]?.address === address),
}))

const QUANTUM_ADDRESS = 'QUANTUMADDRESS'
const STANDARD_ADDRESS = 'STANDARDADDRESS'
const REKEYED_TO_QUANTUM_ADDRESS = 'REKEYEDTOQUANTUMADDRESS'

const buildArc60Request = (signer: string) =>
    ({
        id: 'req-1',
        type: 'auth-data',
        authData: { signer, domain: 'example.com' },
    }) as unknown as SignRequest

const buildArbitraryDataRequest = (signers: string[]) =>
    ({
        id: 'req-1',
        type: 'arbitrary-data',
        data: signers.map(signer => ({ signer, data: 'ZGF0YQ==' })),
    }) as unknown as SignRequest

describe('useIsDataSigningBlocked', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerAlgorandReviewerAdapter()
        messageSignerChainAdapters.reset()
        messageSignerChainAdapters.register(algorandMessageSignerAdapter)
        ;(useAllAccounts as Mock).mockReturnValue([
            {
                chains: { algorand: { address: QUANTUM_ADDRESS } },
                custody: { kind: 'local', seed: 'quantum' },
            },
            {
                chains: { algorand: { address: STANDARD_ADDRESS } },
                custody: { kind: 'local', seed: null },
            },
            {
                chains: { algorand: { address: REKEYED_TO_QUANTUM_ADDRESS } },
                custody: { kind: 'local', seed: null },
            },
        ])
    })

    it('blocks an ARC-60 request whose named signer is a quantum account', () => {
        const { result } = renderHook(() =>
            useIsDataSigningBlocked(buildArc60Request(QUANTUM_ADDRESS)),
        )

        expect(result.current).toBe(true)
    })

    it('blocks an arbitrary-data request when any entry names a quantum signer', () => {
        const { result } = renderHook(() =>
            useIsDataSigningBlocked(
                buildArbitraryDataRequest([STANDARD_ADDRESS, QUANTUM_ADDRESS]),
            ),
        )

        expect(result.current).toBe(true)
    })

    it('does not block a standard account', () => {
        const { result } = renderHook(() =>
            useIsDataSigningBlocked(buildArc60Request(STANDARD_ADDRESS)),
        )

        expect(result.current).toBe(false)
    })

    it('does not block an ed25519 account rekeyed to a quantum auth account', () => {
        // Data signatures are made and verified against the named account's
        // own key — rekey is irrelevant here, unlike transaction signing.
        const { result } = renderHook(() =>
            useIsDataSigningBlocked(
                buildArc60Request(REKEYED_TO_QUANTUM_ADDRESS),
            ),
        )

        expect(result.current).toBe(false)
    })

    it('does not block a signer that matches no known account', () => {
        const { result } = renderHook(() =>
            useIsDataSigningBlocked(buildArc60Request('UNKNOWN')),
        )

        expect(result.current).toBe(false)
    })

    it("asks the chain's message signer, passing the request's kind", () => {
        const signsVerifiably = vi.fn(() => false)
        messageSignerChainAdapters.reset()
        messageSignerChainAdapters.register({
            ...algorandMessageSignerAdapter,
            signsVerifiably,
        })

        const { result } = renderHook(() =>
            useIsDataSigningBlocked(
                buildArbitraryDataRequest([STANDARD_ADDRESS]),
            ),
        )

        expect(result.current).toBe(true)
        expect(signsVerifiably).toHaveBeenCalledWith(
            expect.objectContaining({
                chains: { algorand: { address: STANDARD_ADDRESS } },
            }),
            'arbitraryData',
        )
    })

    it('blocks a known signer on a chain with no message signer', () => {
        messageSignerChainAdapters.reset()

        const { result } = renderHook(() =>
            useIsDataSigningBlocked(buildArc60Request(STANDARD_ADDRESS)),
        )

        expect(result.current).toBe(true)
    })

    it('does not block when there is no request', () => {
        const { result } = renderHook(() => useIsDataSigningBlocked(null))

        expect(result.current).toBe(false)
    })
})
