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

import type { ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type CardConfirmationSheetProps = {
    title: string
    body: string
    confirmLabel: string
    /** True while the confirmed action runs — drives the confirm button.
     * Defaults to false for informational sheets that run no async action. */
    isPending?: boolean
    onConfirm: () => void
    onClose: () => void
    /** Secondary button label; defaults to "Close". */
    closeLabel?: string
    /** Optional visual above the title (e.g. a glyph). */
    header?: ReactNode
    /** Optional content between the body and the actions. */
    children?: ReactNode
    testID?: string
    confirmTestID?: string
    closeTestID?: string
}

/**
 * Shared layout for the card module's confirmation sheets (freeze, unfreeze,
 * withdraw). Content-sized (no scroll view) so it grows to fit; the caller's
 * hook owns the confirmed action so the pending state lives on the confirm
 * button and the sheet stays open on failure.
 */
export const CardConfirmationSheet = ({
    title,
    body,
    confirmLabel,
    isPending = false,
    onConfirm,
    onClose,
    closeLabel,
    header,
    children,
    testID,
    confirmTestID,
    closeTestID,
}: CardConfirmationSheetProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            {header}
            <PWText
                variant='h3'
                style={styles.title}
            >
                {title}
            </PWText>
            <PWText
                variant='bodyLarge'
                style={styles.body}
            >
                {body}
            </PWText>
            {children}
            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    title={confirmLabel}
                    onPress={onConfirm}
                    isLoading={isPending}
                    testID={confirmTestID}
                />
                <PWButton
                    variant='secondary'
                    title={closeLabel ?? t('common.close.label')}
                    onPress={onClose}
                    isDisabled={isPending}
                    testID={closeTestID}
                />
            </PWView>
        </PWView>
    )
}
