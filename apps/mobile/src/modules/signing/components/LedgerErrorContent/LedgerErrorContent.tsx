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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { useLedgerErrorAction } from '@modules/ledger/hooks'
import type { LedgerErrorPreset } from '@modules/ledger/utils/ledgerErrorPresets'
import { useStyles } from './styles'

export type LedgerErrorContentProps = {
    error: LedgerErrorPreset
    onRetry: () => void
    onClose: () => void
    onOpenTroubleshooting: () => void
}

export const LedgerErrorContent = ({
    error,
    onRetry,
    onClose,
    onOpenTroubleshooting,
}: LedgerErrorContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { runAction } = useLedgerErrorAction()
    const { action } = error

    return (
        <ConfirmActionContent
            title={error.title}
            message={
                <PWView style={styles.body}>
                    <PWText
                        variant='body'
                        style={styles.bodyText}
                    >
                        {error.body}
                    </PWText>
                    {error.isTroubleshootable && (
                        <PWTouchableOpacity
                            onPress={onOpenTroubleshooting}
                            testID='ledger-error-troubleshoot'
                        >
                            <PWText
                                variant='body'
                                style={styles.troubleshootLink}
                            >
                                {t('ledger.errors.troubleshooting_link')}
                            </PWText>
                        </PWTouchableOpacity>
                    )}
                </PWView>
            }
            confirmLabel={
                error.isRetryable
                    ? t('ledger.signing.retry')
                    : t('ledger.signing.cancel')
            }
            confirmVariant={error.isRetryable ? 'primary' : 'secondary'}
            onConfirm={error.isRetryable ? onRetry : onClose}
            cancelLabel={
                error.isRetryable ? t('ledger.signing.cancel') : undefined
            }
            onCancel={onClose}
            tertiaryLabel={action?.label}
            tertiaryVariant='secondary'
            onTertiary={action ? () => runAction(action.kind) : undefined}
        />
    )
}
