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

import { useCallback, useMemo } from 'react'
import {
    canSignWith,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

import { AccountDrawerSelectHeader } from './AccountDrawerSelectHeader'
import type { AccountDrawerPickerProps } from './types'

/**
 * How a screen wants the account list shaped. Screens publish the name rather
 * than the props themselves: the props include a header element rebuilt on every
 * render, and pushing that through context state would re-render on a loop.
 */
export type AccountPickerKind = 'portfolio' | 'select'

/** Browsing: portfolio value on top, search, and the Pera Card row. */
export const usePortfolioPicker = (): AccountDrawerPickerProps =>
    useMemo(() => ({ showSearch: true, showPeraCardActivation: true }), [])

/**
 * Picking an account to act with — only accounts this wallet can sign for, and
 * a prompt in place of the portfolio.
 */
export const useSigningPicker = (): AccountDrawerPickerProps => {
    const accounts = useAllAccounts()

    const accountFilter = useCallback(
        (account: WalletAccount) => canSignWith(account, accounts),
        [accounts],
    )

    return useMemo(
        () => ({
            accountFilter,
            hideDefaultHeader: true,
            headerContent: <AccountDrawerSelectHeader />,
        }),
        [accountFilter],
    )
}

/**
 * Both shapes, so the drawer can pick one without calling a hook conditionally.
 * Screens use the specific hook directly and spread it into their own
 * `AccountSelection`, which keeps one definition behind the drawer and the
 * bottom-sheet fallback alike.
 */
export const useAccountPickers = (): Record<
    AccountPickerKind,
    AccountDrawerPickerProps
> => {
    const portfolio = usePortfolioPicker()
    const select = useSigningPicker()

    return useMemo(() => ({ portfolio, select }), [portfolio, select])
}
