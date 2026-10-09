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
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    addressOn,
    authorityTransitionLabel,
    useAccountPresentation,
    useAuthorityOf,
    useCanSignWith,
    useDelegatedTransition,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@modules/webview'
import { splitAccountTypeLabel } from '@utils/rekeyLabels'

type UseAccountTypeInfoParams = {
    account: WalletAccount
}

type UseAccountTypeInfoResult = {
    title: string
    /**
     * Signer qualifier (e.g. "(Signed by a Ledger account)"), shown on its own
     * line below the title. Null for non-rekeyed account types.
     */
    titleQualifier: string | null
    description: string
    handleLearnMore: () => void
}

const REKEYED_UNSIGNABLE_I18N = {
    title: 'account_type_info.no_auth_title',
    description: 'account_type_info.no_auth_description',
}

const REKEYED_SIGNABLE_I18N = {
    title: 'account_type_info.rekeyed_standard_title',
    description: 'account_type_info.rekeyed_standard_description',
}

export const useAccountTypeInfo = ({
    account,
}: UseAccountTypeInfoParams): UseAccountTypeInfoResult => {
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const canSign = useCanSignWith(account, scope.chainId)
    const delegateTransition = useDelegatedTransition(
        addressOn(account, scope),
        scope.chainId,
    )
    const authority = useAuthorityOf(account, scope)
    const presentation = useAccountPresentation(account, scope)
    const transitionLabel = useMemo(
        () =>
            delegateTransition
                ? authorityTransitionLabel(delegateTransition, scope.chainId)
                : null,
        [delegateTransition, scope.chainId],
    )

    const { title, titleQualifier, description } = useMemo(() => {
        if (transitionLabel) {
            const { labelKey, signerKey, descriptionKey } = transitionLabel
            const label = t(labelKey, { to: t(signerKey) })
            const { main, qualifier } = splitAccountTypeLabel(label)
            return {
                title: main,
                titleQualifier: qualifier,
                description: t(descriptionKey),
            }
        }

        if (authority !== null) {
            const i18n = canSign
                ? REKEYED_SIGNABLE_I18N
                : REKEYED_UNSIGNABLE_I18N
            return {
                title: t(i18n.title),
                titleQualifier: null,
                description: t(i18n.description),
            }
        }

        return {
            title: t(
                presentation?.infoTitleKey ?? REKEYED_UNSIGNABLE_I18N.title,
            ),
            titleQualifier: null,
            description: t(
                presentation?.infoBodyKey ??
                    REKEYED_UNSIGNABLE_I18N.description,
            ),
        }
    }, [authority, canSign, transitionLabel, presentation, t])

    const handleLearnMore = useCallback(() => {
        // A rekeyed account's sheet copy describes its signer, not its own
        // kind, so the article has to follow the signer too.
        const url = transitionLabel?.supportUrl ?? presentation?.supportUrl
        if (url) pushWebView({ url })
    }, [pushWebView, transitionLabel, presentation])

    return {
        title,
        titleQualifier,
        description,
        handleLearnMore,
    }
}
