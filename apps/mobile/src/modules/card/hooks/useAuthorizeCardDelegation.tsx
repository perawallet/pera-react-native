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
import { AUTO_FUNDING_PER_TX_LIMIT_USD } from '@perawallet/wallet-core-card'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    formatCurrency,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useRequirePinVerification } from '@modules/security'
import { useLanguage } from '@hooks/useLanguage'

export type UseAuthorizeCardDelegationResult = {
    /**
     * Consent + live PIN/biometric gate before granting a spending delegation.
     * Runs `delegate(account)` only after the user confirms and (if a PIN is
     * set) authenticates; returns false if they back out. Errors thrown by
     * `delegate` propagate to the caller.
     */
    authorizeDelegation: (
        account: WalletAccount,
        delegate: (account: WalletAccount) => Promise<void>,
    ) => Promise<boolean>
}

export const useAuthorizeCardDelegation =
    (): UseAuthorizeCardDelegationResult => {
        const { t } = useLanguage()
        const { requirePinVerification } = useRequirePinVerification()
        const { request: requestBottomSheet } = useBottomSheet()

        const authorizeDelegation = useCallback(
            async (
                account: WalletAccount,
                delegate: (account: WalletAccount) => Promise<void>,
            ): Promise<boolean> => {
                const confirmed = await requestBottomSheet<'confirm'>({
                    contents: (
                        <ConfirmActionContent<'confirm'>
                            icon='shield-check'
                            title={t(
                                'peraCard.account.authorize_delegation_title',
                            )}
                            message={t(
                                'peraCard.account.authorize_delegation_body',
                                {
                                    limit: formatCurrency(
                                        AUTO_FUNDING_PER_TX_LIMIT_USD,
                                        0,
                                        'USD',
                                    ),
                                    account:
                                        account.name ??
                                        truncateAlgorandAddress(
                                            account.address,
                                        ),
                                },
                            )}
                            confirmLabel={t(
                                'peraCard.account.authorize_delegation_confirm',
                            )}
                            cancelLabel={t('common.cancel.label')}
                            confirmValue='confirm'
                            confirmTestID='card_authorize_delegation_confirm'
                            cancelTestID='card_authorize_delegation_cancel'
                        />
                    ),
                    options: {
                        size: 'modal',
                        enablePanDownToClose: true,
                        autoCreateContainer: false,
                    },
                })
                if (confirmed !== 'confirm') return false

                if (!(await requirePinVerification())) return false

                await delegate(account)
                return true
            },
            [t, requirePinVerification, requestBottomSheet],
        )

        return { authorizeDelegation }
    }
