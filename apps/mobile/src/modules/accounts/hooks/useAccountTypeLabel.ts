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

import { useMemo } from 'react'
import {
    AccountTypes,
    useAccountLogicalType,
    useRekeyTransition,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import {
    getRekeyLabelI18n,
    splitAccountTypeLabel,
} from '@modules/accounts/utils/rekeyLabels'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'

export type AccountTypeLabel = {
    /** Full single-line label, e.g. "Rekeyed (Standard to Ledger)". */
    label: string
    /**
     * Main type text, e.g. "Rekeyed". Equal to `label` for every type except
     * a rekeyed signable account, where the transition qualifier is split off.
     */
    main: string
    /**
     * Rekey transition qualifier, e.g. "(Standard to Ledger)". Non-null only
     * for rekeyed signable accounts.
     */
    qualifier: string | null
}

/**
 * Resolves the human-readable account type label (e.g. "Ledger Account",
 * "Rekeyed (Standard to Ledger)"). Shared by the account info card and the
 * account list so both stay in sync.
 */
export const useAccountTypeLabel = (
    account: WalletAccount | null | undefined,
): AccountTypeLabel => {
    const { t } = useLanguage()
    const isMultisig = account?.type === AccountTypes.multisig
    const logicalType =
        useAccountLogicalType(account?.address) ??
        (isMultisig ? 'Multisig' : 'NoAuth')
    const rekeyTransition = useRekeyTransition(account?.address)

    return useMemo(() => {
        const plain = (label: string): AccountTypeLabel => ({
            label,
            main: label,
            qualifier: null,
        })

        if (!account) return plain('')

        switch (logicalType) {
            case 'HdKey':
                return plain(t('account_info.type_universal_wallet'))
            case 'Algo25':
                return plain(t('account_info.type_algo25'))
            case 'LedgerBle':
                return plain(t('account_info.type_ledger'))
            case 'Multisig':
                return plain(t('account_info.type_multisig'))
            case 'NoAuth':
                return plain(t('account_info.type_watch'))
            case 'Rekeyed':
                return plain(t('account_info.type_no_auth'))
            case 'RekeyedAuth': {
                if (!rekeyTransition) {
                    return plain(t('account_info.type_rekeyed'))
                }
                const { labelKey, fromKey, toKey } =
                    getRekeyLabelI18n(rekeyTransition)
                const label = t(labelKey, {
                    from: t(fromKey),
                    to: t(toKey),
                })
                return { label, ...splitAccountTypeLabel(label) }
            }
            default:
                return plain(t('account_info.type_unknown'))
        }
    }, [account, logicalType, rekeyTransition, t])
}
