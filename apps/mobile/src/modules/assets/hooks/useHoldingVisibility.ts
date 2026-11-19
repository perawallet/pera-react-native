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
    hiddenAssetIdsOf,
    useHiddenTokensStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export type UseHoldingVisibilityParams = {
    account: Maybe<WalletAccount>
    scope: ChainScope
    assetId: string
    assetName: string
    /** Where the toast tells the user to unhide it from. */
    hiddenToastBody: I18nKey
}

export type UseHoldingVisibilityResult = {
    /** The account's address on the scope; undefined when it has none there. */
    address: Optional<string>
    isHidden: boolean
    toggleHidden: () => void
}

export const useHoldingVisibility = ({
    account,
    scope,
    assetId,
    assetName,
    hiddenToastBody,
}: UseHoldingVisibilityParams): UseHoldingVisibilityResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const address = account ? addressOn(account, scope) : undefined
    const isHidden = useHiddenTokensStore(
        state =>
            address !== undefined &&
            hiddenAssetIdsOf(state.hiddenTokens, address, scope).includes(
                assetId,
            ),
    )
    const setTokenHidden = useHiddenTokensStore(state => state.setTokenHidden)

    const toggleHidden = useCallback(() => {
        if (address === undefined) return
        setTokenHidden({ address, scope, assetId, isHidden: !isHidden })
        showToast(
            isHidden
                ? {
                      title: t('token_visibility.shown_toast_title', {
                          assetName,
                      }),
                      body: '',
                      type: 'success',
                  }
                : {
                      title: t('token_visibility.hidden_toast_title', {
                          assetName,
                      }),
                      body: t(hiddenToastBody),
                      type: 'success',
                  },
        )
    }, [
        address,
        scope,
        assetId,
        isHidden,
        assetName,
        hiddenToastBody,
        setTokenHidden,
        showToast,
        t,
    ])

    return { address, isHidden, toggleHidden }
}
