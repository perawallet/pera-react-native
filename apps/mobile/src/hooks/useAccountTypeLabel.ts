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
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import {
    addressOn,
    authorityTransitionLabel,
    useAccountPresentation,
    useAuthorityOf,
    useCanSignWith,
    useDelegatedTransition,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable, Maybe } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { splitAccountTypeLabel } from '@utils/rekeyLabels'
import { useHomeChainScope } from '@hooks/useHomeChainScope'

export type AccountTypeLabel = {
    /** Full single-line label, e.g. "Rekeyed (Signed by a Ledger account)". */
    label: string
    /**
     * Main type text, e.g. "Rekeyed". Equal to `label` for every type except
     * a rekeyed signable account, where the signer qualifier is split off.
     */
    main: string
    /**
     * Signer qualifier, e.g. "(Signed by a Ledger account)". Non-null only for
     * rekeyed signable accounts.
     */
    qualifier: Nullable<string>
}

const plain = (label: string): AccountTypeLabel => ({
    label,
    main: label,
    qualifier: null,
})

/**
 * Resolves the human-readable account type label (e.g. "Ledger Account",
 * "Rekeyed (Signed by a Ledger account)"). Shared by the account info card and
 * the account list so both stay in sync.
 */
export const useAccountTypeLabel = (
    account: Maybe<WalletAccount>,
): AccountTypeLabel => {
    const { t } = useLanguage()
    const scope = useHomeChainScope()
    const canSign = useCanSignWith(account, scope.chainId)
    const delegateTransition = useDelegatedTransition(
        account ? addressOn(account, scope) : undefined,
        scope.chainId,
    )
    const authority = useAuthorityOf(account, scope)
    const presentation = useAccountPresentation(account, scope)

    return useMemo(() => {
        if (!account) return plain('')

        if (authority !== null) {
            if (!canSign) {
                return plain(t('account_info.type_no_auth'))
            }
            const transitionLabel = delegateTransition
                ? authorityTransitionLabel(delegateTransition, scope.chainId)
                : null
            if (!transitionLabel) {
                return plain(t('account_info.type_rekeyed'))
            }
            const { labelKey, signerKey } = transitionLabel
            const label = t(labelKey, { to: t(signerKey) })
            return { label, ...splitAccountTypeLabel(label) }
        }

        return plain(
            t(presentation?.labelKey ?? i18nKey('account_info.type_unknown')),
        )
    }, [
        account,
        authority,
        canSign,
        delegateTransition,
        presentation,
        t,
        scope.chainId,
    ])
}
