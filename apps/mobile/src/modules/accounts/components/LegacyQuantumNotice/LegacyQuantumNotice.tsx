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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { PWText, PWView } from '@components/core'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { useLegacyQuantumNotice } from './useLegacyQuantumNotice'
import { useStyles } from './styles'

export type LegacyQuantumNoticeProps = {
    account: WalletAccount
}

/**
 * Renders nothing unless `account` is a legacy-derivation quantum account, so
 * call sites can mount it unconditionally. The one-time auto-opening
 * notification lives in the prompt queue (`useLegacyQuantumPrompt`); this is
 * only the permanent marker that keeps the explanation reachable afterward.
 */
export const LegacyQuantumNotice = ({ account }: LegacyQuantumNoticeProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { isLegacyQuantumAccount, shouldUseDependentAwareCopy } =
        useLegacyQuantumNotice(account)

    if (!isLegacyQuantumAccount) return null

    const bodyKey = shouldUseDependentAwareCopy
        ? 'accounts.legacyQuantum.bodyWithDependents'
        : 'accounts.legacyQuantum.body'

    return (
        <PWView style={styles.markerRow}>
            <InfoButton
                title={t('accounts.legacyQuantum.title')}
                trigger={
                    <PWText
                        variant='footnoteMedium'
                        style={styles.markerLabel}
                    >
                        {t('accounts.legacyQuantum.markerLabel')}
                    </PWText>
                }
                testID='legacy_quantum_notice_marker'
            >
                <PWText>{t(bodyKey)}</PWText>
            </InfoButton>
        </PWView>
    )
}
