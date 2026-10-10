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

import { useMemo } from 'react'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    addressOn,
    useAccountPresentation,
    useAuthorityOf,
    useCanSignWith,
    useDelegatedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { IconName } from '@components/core'
import type { PWRoundIconVariant } from '@components/core/PWRoundIcon'

export type AccountDisplayState =
    | 'base'
    | 'rekeyedSignable'
    | 'rekeyedUnsignable'

export type AccountGlyph = { name: IconName; variant: PWRoundIconVariant }

// A presentation's glyph id is the PWIcon name; this table gives it its tone.
const GLYPH_TONE = {
    'accounts/glyph/algo25-account': 'accountTurquoise',
    'accounts/glyph/hdwallet-account': 'accountTurquoise',
    'accounts/glyph/ledger-account': 'accountPurple',
    'accounts/glyph/multisig-account': 'accountMagenta',
    'accounts/glyph/watch-account': 'accountPink',
    'accounts/glyph/quantum-account': 'accountQuantum',
    'accounts/glyph/rekeyed-standard': 'accountTurquoise',
    'accounts/glyph/rekeyed-ledger': 'accountPurple',
    'accounts/glyph/rekeyed-multisig': 'accountMagenta',
    'accounts/glyph/noauth-account': 'accountPeach',
    'accounts/glyph/unknown-account': 'accountNeutral',
} as const satisfies Partial<Record<IconName, PWRoundIconVariant>>

type KnownGlyph = keyof typeof GLYPH_TONE

const REKEYED_SIGNABLE_GLYPH: KnownGlyph = 'accounts/glyph/rekeyed-standard'
const REKEYED_UNSIGNABLE_GLYPH: KnownGlyph = 'accounts/glyph/noauth-account'
const FALLBACK_GLYPH: KnownGlyph = 'accounts/glyph/unknown-account'

const isKnownGlyph = (glyphId: string): glyphId is KnownGlyph =>
    Object.hasOwn(GLYPH_TONE, glyphId)

/** The icon for a presentation glyph id; the neutral unknown glyph for an id the app has no icon for. */
export const accountGlyphFor = (glyphId: string | undefined): AccountGlyph => {
    const name = glyphId && isKnownGlyph(glyphId) ? glyphId : FALLBACK_GLYPH
    return { name, variant: GLYPH_TONE[name] }
}

export type UseAccountIconOptions = {
    /**
     * When true, render the icon for the account's own kind and ignore its
     * rekey state (e.g. the undo-rekey preview).
     */
    ignoreRekey?: boolean
    /**
     * Force the display state. Use for accounts not yet in the store
     * (e.g. import previews) where `canSignWith` can't resolve from store
     * state alone.
     */
    displayState?: AccountDisplayState
    /**
     * The auth account, for callers that force `rekeyedSignable` on a
     * synthetic account. `useDelegatedAccount` can only resolve an auth address
     * that is already in the store, so without this a rekeyed-to-Ledger
     * preview falls back to the turquoise standard glyph.
     */
    authAccount?: WalletAccount
}

export const useAccountIcon = (
    account: WalletAccount | undefined,
    options: UseAccountIconOptions = {},
): AccountGlyph | null => {
    const { ignoreRekey, displayState, authAccount } = options
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const rekeyAccount = useDelegatedAccount(
        account ? addressOn(account, scope) : undefined,
        scope.chainId,
    )
    const canSign = useCanSignWith(account, scope.chainId)
    const authority = useAuthorityOf(account, scope)
    const presentation = useAccountPresentation(account, scope)
    // Keyed off the auth account (what it's rekeyed *to*), not the account
    // itself: a standard account rekeyed to a Ledger shows the ledger glyph.
    const authPresentation = useAccountPresentation(
        rekeyAccount ?? authAccount,
        scope,
    )

    return useMemo(() => {
        if (!account) return null

        const isRekeyed = !ignoreRekey && authority !== null
        const state: AccountDisplayState =
            displayState ??
            (isRekeyed
                ? canSign
                    ? 'rekeyedSignable'
                    : 'rekeyedUnsignable'
                : 'base')

        switch (state) {
            case 'rekeyedSignable': {
                return accountGlyphFor(
                    authPresentation?.delegatedGlyph ?? REKEYED_SIGNABLE_GLYPH,
                )
            }
            case 'rekeyedUnsignable': {
                return accountGlyphFor(REKEYED_UNSIGNABLE_GLYPH)
            }
            case 'base': {
                return accountGlyphFor(presentation?.glyph)
            }
        }
    }, [
        account,
        ignoreRekey,
        displayState,
        canSign,
        authority,
        presentation,
        authPresentation,
    ])
}
