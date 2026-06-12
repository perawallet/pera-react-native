/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useRekeyAccount: vi.fn(() => undefined),
        useCanSignWith: vi.fn(() => true),
        isRekeyedAccount: vi.fn(() => false),
    }
})

import {
    AccountTypes,
    isRekeyedAccount,
    useCanSignWith,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useAccountIcon } from '../useAccountIcon'

const account = (type: WalletAccount['type']): WalletAccount =>
    ({ type, address: 'ADDR' }) as WalletAccount

describe('useAccountIcon', () => {
    beforeEach(() => {
        vi.mocked(isRekeyedAccount).mockReturnValue(false)
        vi.mocked(useCanSignWith).mockReturnValue(true)
    })

    it('returns null without an account', () => {
        const { result } = renderHook(() => useAccountIcon(undefined))
        expect(result.current).toBeNull()
    })

    it('maps a base algo25 account to the turquoise glyph', () => {
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.algo25)),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/algo25-account',
            variant: 'accountTurquoise',
        })
    })

    it('maps a hardware account to the purple ledger glyph', () => {
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.hardware)),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/ledger-account',
            variant: 'accountPurple',
        })
    })

    it('returns the rekeyed-standard glyph for a signable rekeyed account', () => {
        vi.mocked(isRekeyedAccount).mockReturnValue(true)
        vi.mocked(useCanSignWith).mockReturnValue(true)
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.algo25)),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-standard',
            variant: 'accountTurquoise',
        })
    })

    it('returns the noauth glyph for an unsignable rekeyed account', () => {
        vi.mocked(isRekeyedAccount).mockReturnValue(true)
        vi.mocked(useCanSignWith).mockReturnValue(false)
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.algo25)),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/noauth-account',
            variant: 'accountPeach',
        })
    })

    it('ignoreRekey forces the base glyph', () => {
        vi.mocked(isRekeyedAccount).mockReturnValue(true)
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.watch), { ignoreRekey: true }),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/watch-account',
            variant: 'accountPink',
        })
    })

    it('returns the rekeyed-multisig glyph for a signable rekeyed multisig account', () => {
        vi.mocked(isRekeyedAccount).mockReturnValue(true)
        vi.mocked(useCanSignWith).mockReturnValue(true)
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.multisig)),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-multisig',
            variant: 'accountMagenta',
        })
    })

    it('lets an explicit displayState override the derived state', () => {
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.algo25), {
                displayState: 'rekeyedUnsignable',
            }),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/noauth-account',
            variant: 'accountPeach',
        })
    })
})
