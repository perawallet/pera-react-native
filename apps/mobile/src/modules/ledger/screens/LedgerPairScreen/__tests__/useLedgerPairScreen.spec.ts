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
import { act, renderHook } from '@testing-library/react'

const { navigate, requestBottomSheet, flowChain } = vi.hoisted(() => ({
    navigate: vi.fn(),
    requestBottomSheet: vi.fn(),
    flowChain: { id: 'algorand' },
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate }),
}))
vi.mock('@hooks/useLanguage')
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: requestBottomSheet }),
}))
vi.mock('@modules/ledger/hooks', () => ({
    useLedgerFlowChainId: () => flowChain.id,
}))
vi.mock('../../../components/LedgerHowItWorksContent', () => ({
    LedgerHowItWorksContent: () => null,
}))
vi.mock('@perawallet/wallet-core-hardware-wallet', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-hardware-wallet')
    >()),
    ledgerAppNameFor: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : 'Algorand',
}))

import { useLedgerPairScreen } from '../useLedgerPairScreen'

describe('useLedgerPairScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        flowChain.id = 'ethereum'
    })

    it('scans on the flow chain', () => {
        const { result } = renderHook(() => useLedgerPairScreen())

        act(() => {
            result.current.handlePair()
        })

        expect(navigate).toHaveBeenCalledWith('LedgerScan', {
            chainId: 'ethereum',
        })
    })

    it("explains pairing with the flow chain's device app", () => {
        const { result } = renderHook(() => useLedgerPairScreen())

        act(() => {
            result.current.handleOpenHowDoesItWork()
        })

        const [{ contents }] = requestBottomSheet.mock.calls[0] as [
            { contents: { props: { appName: string } } },
        ]
        expect(contents.props.appName).toBe('Ethereum')
    })
})
