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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import type { LedgerErrorPreset } from '@modules/ledger/utils'

/** `undefined` (cancel or swipe-away) abandons the add. */
export type LedgerSameWalletChoice = 'read' | 'separate'

export type LedgerSameWalletSheetProps = {
    /** The device app holding the chain the existing account is on. */
    appName: string
    /** Why the last read of that app failed, if it did. */
    failure: Nullable<LedgerErrorPreset>
}

export const LedgerSameWalletSheet = ({
    appName,
    failure,
}: LedgerSameWalletSheetProps) => {
    const { t } = useLanguage()
    const separateLabel = t('ledger.verify.same_wallet_separate')
    // A failure a retry can't clear leaves the separate account as the way on.
    const canRead = failure === null || failure.isRetryable
    return (
        <ConfirmActionContent<LedgerSameWalletChoice>
            icon='ledger'
            title={t('ledger.verify.same_wallet_title')}
            message={[
                failure?.body,
                t('ledger.verify.same_wallet_body', { appName }),
            ]
                .filter(Boolean)
                .join('\n\n')}
            confirmLabel={
                canRead ? t('ledger.verify.same_wallet_confirm') : separateLabel
            }
            confirmValue={canRead ? 'read' : 'separate'}
            tertiaryLabel={canRead ? separateLabel : undefined}
            tertiaryVariant='secondary'
            tertiaryValue='separate'
            cancelLabel={t('common.cancel.label')}
            testID='ledger-same-wallet-sheet'
            confirmTestID='ledger-same-wallet-confirm'
            tertiaryTestID='ledger-same-wallet-separate'
            cancelTestID='ledger-same-wallet-cancel'
        />
    )
}
