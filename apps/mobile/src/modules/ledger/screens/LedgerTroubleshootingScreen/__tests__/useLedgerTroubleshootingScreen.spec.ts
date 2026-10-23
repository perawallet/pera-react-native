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

import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const { goBack, flowChain } = vi.hoisted(() => ({
    goBack: vi.fn(),
    flowChain: { id: 'algorand' },
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack }),
}))
vi.mock('@hooks/useLanguage')
vi.mock('../../../hooks', () => ({
    useLedgerFlowChainId: () => flowChain.id,
}))
vi.mock('@perawallet/wallet-core-hardware-wallet', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-hardware-wallet')
    >()),
    ledgerAppNameFor: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : 'Algorand',
}))

import { useLedgerTroubleshootingScreen } from '../useLedgerTroubleshootingScreen'

describe('useLedgerTroubleshootingScreen', () => {
    it.each([
        ['algorand', 'Algorand'],
        ['ethereum', 'Ethereum'],
    ])("names %s's device app in the pairing steps", (chainId, appName) => {
        flowChain.id = chainId

        const { result } = renderHook(() => useLedgerTroubleshootingScreen())

        expect(result.current.appName).toBe(appName)
    })

    it('goes back when done', () => {
        const { result } = renderHook(() => useLedgerTroubleshootingScreen())

        act(() => {
            result.current.handleDone()
        })

        expect(goBack).toHaveBeenCalledTimes(1)
    })
})
