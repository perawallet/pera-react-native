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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    useHiddenTokensStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { useHoldingVisibility } from '../useHoldingVisibility'

const mockShowToast = vi.fn()

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useLanguage')

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ADDRESS = `0x${'a'.repeat(40)}`
const ACCOUNT = {
    id: 'eth',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: ADDRESS } },
} as unknown as WalletAccount

const renderVisibility = (account: WalletAccount | null = ACCOUNT) =>
    renderHook(() =>
        useHoldingVisibility({
            account,
            scope: SCOPE,
            assetId: '0xabc/7',
            assetName: 'Airdrop #7',
            hiddenToastBody: i18nKey('nft_visibility.hidden_toast_body'),
        }),
    )

describe('useHoldingVisibility', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useHiddenTokensStore.getState().resetState()
    })

    it('hides the holding for the account and toasts the given body', () => {
        const { result } = renderVisibility()

        act(() => result.current.toggleHidden())

        expect(result.current.isHidden).toBe(true)
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'token_visibility.hidden_toast_title',
                body: 'nft_visibility.hidden_toast_body',
            }),
        )
    })

    it('unhides a hidden holding with a toast that has no body', () => {
        const { result } = renderVisibility()

        act(() => result.current.toggleHidden())
        act(() => result.current.toggleHidden())

        expect(result.current.isHidden).toBe(false)
        expect(mockShowToast).toHaveBeenLastCalledWith(
            expect.objectContaining({
                title: 'token_visibility.shown_toast_title',
                body: '',
            }),
        )
    })

    it('does nothing for an account with no address on the scope', () => {
        const { result } = renderVisibility(null)

        act(() => result.current.toggleHidden())

        expect(result.current.address).toBeUndefined()
        expect(useHiddenTokensStore.getState().hiddenTokens).toEqual({})
        expect(mockShowToast).not.toHaveBeenCalled()
    })
})
