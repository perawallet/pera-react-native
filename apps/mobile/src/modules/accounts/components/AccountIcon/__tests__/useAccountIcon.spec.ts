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
    useRekeyAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useAccountIcon } from '../useAccountIcon'

const account = (type: WalletAccount['type']): WalletAccount =>
    ({ type, address: 'ADDR' }) as WalletAccount

describe('useAccountIcon', () => {
    beforeEach(() => {
        vi.mocked(isRekeyedAccount).mockReturnValue(false)
        vi.mocked(useCanSignWith).mockReturnValue(true)
        vi.mocked(useRekeyAccount).mockReturnValue(null)
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

    it('returns the purple rekeyed-ledger glyph when a standard account is rekeyed to a Ledger auth account', () => {
        vi.mocked(isRekeyedAccount).mockReturnValue(true)
        vi.mocked(useCanSignWith).mockReturnValue(true)
        vi.mocked(useRekeyAccount).mockReturnValue(
            account(AccountTypes.hardware),
        )
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.algo25)),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-ledger',
            variant: 'accountPurple',
        })
    })

    // The Ledger info sheet forces `rekeyedSignable` on a synthetic account whose
    // auth Ledger is not in the store, so `useRekeyAccount` resolves nothing and
    // the glyph fell back to the turquoise standard one (PERA-4403).
    it('uses the supplied auth type when the auth account is not in the store', () => {
        vi.mocked(isRekeyedAccount).mockReturnValue(false)
        vi.mocked(useCanSignWith).mockReturnValue(false)
        vi.mocked(useRekeyAccount).mockReturnValue(null)

        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.watch), {
                displayState: 'rekeyedSignable',
                authType: AccountTypes.hardware,
            }),
        )

        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-ledger',
            variant: 'accountPurple',
        })
    })

    it('still falls back to the standard glyph with no auth type to go on', () => {
        vi.mocked(isRekeyedAccount).mockReturnValue(false)
        vi.mocked(useCanSignWith).mockReturnValue(false)
        vi.mocked(useRekeyAccount).mockReturnValue(null)

        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.watch), {
                displayState: 'rekeyedSignable',
            }),
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
        vi.mocked(useRekeyAccount).mockReturnValue(
            account(AccountTypes.multisig),
        )
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

    it('returns the quantum glyph with the quantum variant for a base quantum account', () => {
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.quantum)),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/quantum-account',
            variant: 'accountQuantum',
        })
    })

    it('falls through to the standard rekeyed glyph for a rekeyed-signable quantum account', () => {
        vi.mocked(isRekeyedAccount).mockReturnValue(true)
        vi.mocked(useCanSignWith).mockReturnValue(true)
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.quantum)),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-standard',
            variant: 'accountTurquoise',
        })
    })

    it('shows the noauth glyph for a rekeyed-unsignable quantum account', () => {
        vi.mocked(isRekeyedAccount).mockReturnValue(true)
        vi.mocked(useCanSignWith).mockReturnValue(false)
        const { result } = renderHook(() =>
            useAccountIcon(account(AccountTypes.quantum)),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/noauth-account',
            variant: 'accountPeach',
        })
    })
})
