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
    useRekeyTransition,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import {
    getRekeyLabelI18n,
    splitAccountTypeLabel,
} from '@modules/accounts/utils/rekeyLabels'

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
    qualifier: string | null
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
    account: WalletAccount | null | undefined,
): AccountTypeLabel => {
    const { t } = useLanguage()
    const canSign = useCanSignWith(account)
    const rekeyTransition = useRekeyTransition(account?.address)

    return useMemo(() => {
        if (!account) return plain('')

        if (isRekeyedAccount(account)) {
            if (!canSign) {
                return plain(t('account_info.type_no_auth'))
            }
            if (!rekeyTransition) {
                return plain(t('account_info.type_rekeyed'))
            }
            const { labelKey, signerKey } = getRekeyLabelI18n(rekeyTransition)
            const label = t(labelKey, { to: t(signerKey) })
            return { label, ...splitAccountTypeLabel(label) }
        }

        switch (account.type) {
            case AccountTypes.hdWallet: {
                return plain(t('account_info.type_universal_wallet'))
            }
            case AccountTypes.algo25: {
                return plain(t('account_info.type_algo25'))
            }
            case AccountTypes.quantum: {
                return plain(t('account_info.type_quantum'))
            }
            case AccountTypes.hardware: {
                return plain(t('account_info.type_ledger'))
            }
            case AccountTypes.multisig: {
                return canSign
                    ? plain(t('account_info.type_multisig'))
                    : plain(t('account_info.type_no_auth'))
            }
            case AccountTypes.watch: {
                return plain(t('account_info.type_watch'))
            }
            default: {
                return plain(t('account_info.type_unknown'))
            }
        }
    }, [account, canSign, rekeyTransition, t])
}
