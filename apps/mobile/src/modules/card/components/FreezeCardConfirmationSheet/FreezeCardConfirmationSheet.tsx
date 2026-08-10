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
import { trackEvent, CardEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useCardFreezeAction } from '../../hooks'
import { CardConfirmationSheet } from '../CardConfirmationSheet'
import { CardBadgeGlyph } from '../CardBadgeGlyph'

/**
 * Confirmation sheet shown before freezing a card. Freezing runs here — the
 * confirm button shows the pending state and the sheet closes on success.
 */
export const FreezeCardConfirmationSheet = () => {
    const { t } = useLanguage()
    const { isFreezing, onConfirm, onClose } = useCardFreezeAction()

    // Tracked here, not in useCardFreezeAction — the action hook is shared
    // with the lost/stolen and report-suspicious sheets, which have their own events.
    const handleConfirm = useCallback(() => {
        trackEvent(CardEvent.FreezeCard)
        onConfirm()
    }, [onConfirm])
    const handleClose = useCallback(() => {
        trackEvent(CardEvent.FreezeClose)
        onClose()
    }, [onClose])

    return (
        <CardConfirmationSheet
            header={<CardBadgeGlyph size='lg' />}
            title={t('peraCard.account.freeze_sheet_title')}
            body={t('peraCard.account.freeze_sheet_body')}
            confirmLabel={t('peraCard.account.freeze_sheet_confirm')}
            isPending={isFreezing}
            onConfirm={handleConfirm}
            onClose={handleClose}
            testID='freeze_card_confirmation_sheet'
            confirmTestID='freeze_confirm_button'
            closeTestID='freeze_close_button'
        />
    )
}
