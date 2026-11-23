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

import { useCallback } from 'react'
import {
    addressOn,
    assetFromHoldingLiteRow,
    useHiddenTokensStore,
    useKeptTokensStore,
    useSelectedAccount,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useAutoHiddenHoldings } from '../../hooks/useAutoHiddenHoldings'

type UseAutoHiddenTokensScreenResult = {
    rows: AccountHoldingsLiteRow[]
    isPending: boolean
    showsNetwork: boolean
    handleUnhide: (row: AccountHoldingsLiteRow) => void
    t: ReturnType<typeof useLanguage>['t']
}

export const useAutoHiddenTokensScreen =
    (): UseAutoHiddenTokensScreenResult => {
        const { t } = useLanguage()
        const { showToast } = useToast()
        const account = useSelectedAccount()
        const { holdings, isPending, showsNetwork } =
            useAutoHiddenHoldings(account)
        const setTokenKept = useKeptTokensStore(state => state.setTokenKept)
        const setTokenHidden = useHiddenTokensStore(
            state => state.setTokenHidden,
        )

        // Unhiding outranks an earlier hide too: the user asked to see it.
        const handleUnhide = useCallback(
            (row: AccountHoldingsLiteRow) => {
                const address = account
                    ? addressOn(account, row.scope)
                    : undefined
                if (address === undefined) return
                const target = {
                    address,
                    scope: row.scope,
                    assetId: row.assetId,
                }
                setTokenKept({ ...target, isKept: true })
                setTokenHidden({ ...target, isHidden: false })
                const asset = assetFromHoldingLiteRow(row, row.scope.chainId)
                showToast({
                    title: t('token_visibility.shown_toast_title', {
                        assetName: asset?.name ?? asset?.unitName ?? '',
                    }),
                    body: '',
                    type: 'success',
                })
            },
            [account, setTokenKept, setTokenHidden, showToast, t],
        )

        return { rows: holdings, isPending, showsNetwork, handleUnhide, t }
    }
