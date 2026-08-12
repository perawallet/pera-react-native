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

import {
    AccountTypes,
    isRekeyedAccount,
    useCanSignWith,
    useRekeyAccount,
    type AccountType,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { type IconName } from '@components/core'
import { type PWRoundIconVariant } from '@components/core/PWRoundIcon'

export type AccountDisplayState =
    | 'base'
    | 'rekeyedSignable'
    | 'rekeyedUnsignable'

export type AccountGlyph = { name: IconName; variant: PWRoundIconVariant }

const BASE_GLYPH: Record<AccountType, AccountGlyph> = {
    [AccountTypes.algo25]: {
        name: 'accounts/glyph/algo25-account',
        variant: 'accountTurquoise',
    },
    [AccountTypes.hdWallet]: {
        name: 'accounts/glyph/hdwallet-account',
        variant: 'accountTurquoise',
    },
    [AccountTypes.hardware]: {
        name: 'accounts/glyph/ledger-account',
        variant: 'accountPurple',
    },
    [AccountTypes.multisig]: {
        name: 'accounts/glyph/multisig-account',
        variant: 'accountMagenta',
    },
    [AccountTypes.watch]: {
        name: 'accounts/glyph/watch-account',
        variant: 'accountPink',
    },
    [AccountTypes.quantum]: {
        name: 'accounts/glyph/quantum-account',
        variant: 'accountQuantum',
    },
}

const REKEYED_SIGNABLE_GLYPH: Partial<Record<AccountType, AccountGlyph>> = {
    [AccountTypes.hardware]: {
        name: 'accounts/glyph/rekeyed-ledger',
        variant: 'accountPurple',
    },
    [AccountTypes.multisig]: {
        name: 'accounts/glyph/rekeyed-multisig',
        variant: 'accountMagenta',
    },
}

const REKEYED_SIGNABLE_DEFAULT: AccountGlyph = {
    name: 'accounts/glyph/rekeyed-standard',
    variant: 'accountTurquoise',
}

const REKEYED_UNSIGNABLE_GLYPH: AccountGlyph = {
    name: 'accounts/glyph/noauth-account',
    variant: 'accountPeach',
}

const FALLBACK_GLYPH: AccountGlyph = {
    name: 'accounts/glyph/unknown-account',
    variant: 'accountNeutral',
}

export type UseAccountIconOptions = {
    /**
     * When true, render the icon for the account's base `type` and ignore
     * its rekey state (e.g. the undo-rekey preview).
     */
    ignoreRekey?: boolean
    /**
     * Force the display state. Use for accounts not yet in the store
     * (e.g. import previews) where `canSignWith` can't resolve from store
     * state alone.
     */
    displayState?: AccountDisplayState
    /**
     * The type of the auth account, for callers that force `rekeyedSignable`
     * on a synthetic account. `useRekeyAccount` can only resolve an auth
     * address that is already in the store, so without this a rekeyed-to-Ledger
     * preview falls back to the turquoise standard glyph (PERA-4403).
     */
    authType?: AccountType
}

export const useAccountIcon = (
    account: WalletAccount | undefined,
    options: UseAccountIconOptions = {},
): AccountGlyph | null => {
    const { ignoreRekey, displayState, authType } = options
    const rekeyAccount = useRekeyAccount(account?.address)
    const canSign = useCanSignWith(account)

    return useMemo(() => {
        if (!account) return null

        const isRekeyed = !ignoreRekey && isRekeyedAccount(account)
        const state: AccountDisplayState =
            displayState ??
            (isRekeyed
                ? canSign
                    ? 'rekeyedSignable'
                    : 'rekeyedUnsignable'
                : 'base')

        switch (state) {
            case 'rekeyedSignable': {
                // Key off the auth account's type (what it's rekeyed *to*),
                // not the account's own type — a standard account rekeyed to
                // a Ledger keeps type `algo25`, so indexing by `account.type`
                // wrongly picks the standard glyph instead of the ledger one.
                const resolvedAuthType = rekeyAccount?.type ?? authType
                const authGlyph = resolvedAuthType
                    ? REKEYED_SIGNABLE_GLYPH[resolvedAuthType]
                    : undefined
                return authGlyph ?? REKEYED_SIGNABLE_DEFAULT
            }
            case 'rekeyedUnsignable': {
                return REKEYED_UNSIGNABLE_GLYPH
            }
            case 'base': {
                return BASE_GLYPH[account.type] ?? FALLBACK_GLYPH
            }
        }
        // rekeyAccount keeps the memo invalidating when the auth account
        // changes (which can flip canSign).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account, ignoreRekey, displayState, authType, canSign, rekeyAccount])
}
