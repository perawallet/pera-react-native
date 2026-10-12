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
import { act, renderHook } from '@testing-library/react'

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useDelegatedAccount: vi.fn(() => undefined),
        useCanSignWith: vi.fn(() => true),
        useAuthorityOf: vi.fn(() => null),
    }
})

import {
    useAuthorityOf,
    useCanSignWith,
    useDelegatedAccount,
} from '@perawallet/wallet-core-accounts'
import { accountGlyphFor, useAccountIcon } from '../useAccountIcon'
import {
    accountForType,
    type AlgorandAccountKind,
} from '@test-utils/accountCustody'
import {
    registerAlgorandAccountsAdapter,
    seedAuthority,
} from '@test-utils/algorandAccountsAdapter'

const account = (type: AlgorandAccountKind) => accountForType(type, 'ADDR')

describe('useAccountIcon', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        vi.mocked(useAuthorityOf).mockReturnValue(null)
        vi.mocked(useCanSignWith).mockReturnValue(true)
        vi.mocked(useDelegatedAccount).mockReturnValue(null)
    })

    it('returns null without an account', () => {
        const { result } = renderHook(() => useAccountIcon(undefined))
        expect(result.current).toBeNull()
    })

    it('maps a base algo25 account to the turquoise glyph', () => {
        const { result } = renderHook(() =>
            useAccountIcon(account('standalone')),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/algo25-account',
            variant: 'accountTurquoise',
        })
    })

    it('maps a hardware account to the purple ledger glyph', () => {
        const { result } = renderHook(() => useAccountIcon(account('hardware')))
        expect(result.current).toEqual({
            name: 'accounts/glyph/ledger-account',
            variant: 'accountPurple',
        })
    })

    it('returns the rekeyed-standard glyph for a signable rekeyed account', () => {
        vi.mocked(useAuthorityOf).mockReturnValue('AUTH')
        vi.mocked(useCanSignWith).mockReturnValue(true)
        const { result } = renderHook(() =>
            useAccountIcon(account('standalone')),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-standard',
            variant: 'accountTurquoise',
        })
    })

    it('returns the purple rekeyed-ledger glyph when a standard account is rekeyed to a Ledger auth account', () => {
        vi.mocked(useAuthorityOf).mockReturnValue('AUTH')
        vi.mocked(useCanSignWith).mockReturnValue(true)
        vi.mocked(useDelegatedAccount).mockReturnValue(account('hardware'))
        const { result } = renderHook(() =>
            useAccountIcon(account('standalone')),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-ledger',
            variant: 'accountPurple',
        })
    })

    // The Ledger info sheet forces `rekeyedSignable` on a synthetic account whose
    // auth Ledger is not in the store, so `useDelegatedAccount` resolves nothing and
    // the glyph fell back to the turquoise standard one.
    it('uses the supplied auth account when it is not in the store', () => {
        vi.mocked(useAuthorityOf).mockReturnValue(null)
        vi.mocked(useCanSignWith).mockReturnValue(false)
        vi.mocked(useDelegatedAccount).mockReturnValue(null)

        const { result } = renderHook(() =>
            useAccountIcon(account('watch'), {
                displayState: 'rekeyedSignable',
                authAccount: account('hardware'),
            }),
        )

        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-ledger',
            variant: 'accountPurple',
        })
    })

    it('still falls back to the standard glyph with no auth account to go on', () => {
        vi.mocked(useAuthorityOf).mockReturnValue(null)
        vi.mocked(useCanSignWith).mockReturnValue(false)
        vi.mocked(useDelegatedAccount).mockReturnValue(null)

        const { result } = renderHook(() =>
            useAccountIcon(account('watch'), {
                displayState: 'rekeyedSignable',
            }),
        )

        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-standard',
            variant: 'accountTurquoise',
        })
    })

    it('returns the noauth glyph for an unsignable rekeyed account', () => {
        vi.mocked(useAuthorityOf).mockReturnValue('AUTH')
        vi.mocked(useCanSignWith).mockReturnValue(false)
        const { result } = renderHook(() =>
            useAccountIcon(account('standalone')),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/noauth-account',
            variant: 'accountPeach',
        })
    })

    it('ignoreRekey forces the base glyph', () => {
        vi.mocked(useAuthorityOf).mockReturnValue('AUTH')
        const { result } = renderHook(() =>
            useAccountIcon(account('watch'), { ignoreRekey: true }),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/watch-account',
            variant: 'accountPink',
        })
    })

    it('returns the rekeyed-multisig glyph for a signable rekeyed multisig account', () => {
        vi.mocked(useAuthorityOf).mockReturnValue('AUTH')
        vi.mocked(useCanSignWith).mockReturnValue(true)
        vi.mocked(useDelegatedAccount).mockReturnValue(account('multisig'))
        const { result } = renderHook(() => useAccountIcon(account('multisig')))
        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-multisig',
            variant: 'accountMagenta',
        })
    })

    it('lets an explicit displayState override the derived state', () => {
        const { result } = renderHook(() =>
            useAccountIcon(account('standalone'), {
                displayState: 'rekeyedUnsignable',
            }),
        )
        expect(result.current).toEqual({
            name: 'accounts/glyph/noauth-account',
            variant: 'accountPeach',
        })
    })

    it('returns the quantum glyph with the quantum variant for a base quantum account', () => {
        const { result } = renderHook(() => useAccountIcon(account('quantum')))
        expect(result.current).toEqual({
            name: 'accounts/glyph/quantum-account',
            variant: 'accountQuantum',
        })
    })

    it('falls through to the standard rekeyed glyph for a rekeyed-signable quantum account', () => {
        vi.mocked(useAuthorityOf).mockReturnValue('AUTH')
        vi.mocked(useCanSignWith).mockReturnValue(true)
        const { result } = renderHook(() => useAccountIcon(account('quantum')))
        expect(result.current).toEqual({
            name: 'accounts/glyph/rekeyed-standard',
            variant: 'accountTurquoise',
        })
    })

    it('shows the noauth glyph for a rekeyed-unsignable quantum account', () => {
        vi.mocked(useAuthorityOf).mockReturnValue('AUTH')
        vi.mocked(useCanSignWith).mockReturnValue(false)
        const { result } = renderHook(() => useAccountIcon(account('quantum')))
        expect(result.current).toEqual({
            name: 'accounts/glyph/noauth-account',
            variant: 'accountPeach',
        })
    })

    it('flips to the rekeyed glyph when an authority is recorded after mount', async () => {
        const actual = await vi.importActual<
            typeof import('@perawallet/wallet-core-accounts')
        >('@perawallet/wallet-core-accounts')
        vi.mocked(useAuthorityOf).mockImplementation(actual.useAuthorityOf)
        const { result } = renderHook(() =>
            useAccountIcon(account('standalone')),
        )
        expect(result.current?.name).toBe('accounts/glyph/algo25-account')

        act(() => seedAuthority('ADDR', 'AUTH'))

        expect(result.current?.name).toBe('accounts/glyph/rekeyed-standard')
    })
})

describe('accountGlyphFor', () => {
    it.each([
        ['accounts/glyph/algo25-account', 'accountTurquoise'],
        ['accounts/glyph/hdwallet-account', 'accountTurquoise'],
        ['accounts/glyph/ledger-account', 'accountPurple'],
        ['accounts/glyph/multisig-account', 'accountMagenta'],
        ['accounts/glyph/watch-account', 'accountPink'],
        ['accounts/glyph/quantum-account', 'accountQuantum'],
        ['accounts/glyph/rekeyed-standard', 'accountTurquoise'],
        ['accounts/glyph/rekeyed-ledger', 'accountPurple'],
        ['accounts/glyph/rekeyed-multisig', 'accountMagenta'],
        ['accounts/glyph/noauth-account', 'accountPeach'],
    ])('gives %s the %s tone', (glyphId, variant) => {
        expect(accountGlyphFor(glyphId)).toEqual({ name: glyphId, variant })
    })

    it('falls back to the neutral unknown glyph for an id the app has no icon for', () => {
        expect(accountGlyphFor('accounts/glyph/some-future-kind')).toEqual({
            name: 'accounts/glyph/unknown-account',
            variant: 'accountNeutral',
        })
        expect(accountGlyphFor(undefined)).toEqual({
            name: 'accounts/glyph/unknown-account',
            variant: 'accountNeutral',
        })
    })
})
