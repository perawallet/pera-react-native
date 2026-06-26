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

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { FrozenCardGlyph } from '../FrozenCardGlyph'
import { useFreezeCardConfirmationSheet } from './useFreezeCardConfirmationSheet'
import { useStyles } from './styles'

/**
 * Confirmation sheet shown before freezing a card. Content-sized (no scroll view)
 * so it grows to fit. Freezing runs here — the confirm button shows the pending
 * state and the sheet closes on success.
 */
export const FreezeCardConfirmationSheet = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const { isFreezing, onConfirm, onClose } = useFreezeCardConfirmationSheet()

    return (
        <PWView
            style={styles.container}
            testID='freeze_card_confirmation_sheet'
        >
            <FrozenCardGlyph size='lg' />
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('peraCard.account.freeze_sheet_title')}
            </PWText>
            <PWText
                variant='bodyLarge'
                style={styles.body}
            >
                {t('peraCard.account.freeze_sheet_body')}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    title={t('peraCard.account.freeze_sheet_confirm')}
                    onPress={onConfirm}
                    isLoading={isFreezing}
                    testID='freeze_confirm_button'
                />
                <PWButton
                    variant='secondary'
                    title={t('common.close.label')}
                    onPress={onClose}
                    isDisabled={isFreezing}
                    testID='freeze_close_button'
                />
            </PWView>
        </PWView>
    )
}
