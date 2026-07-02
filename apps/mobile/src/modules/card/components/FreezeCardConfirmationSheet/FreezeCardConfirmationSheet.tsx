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

import { useLanguage } from '@hooks/useLanguage'
import { CardConfirmationSheet } from '../CardConfirmationSheet'
import { FrozenCardGlyph } from '../FrozenCardGlyph'
import { useFreezeCardConfirmationSheet } from './useFreezeCardConfirmationSheet'

/**
 * Confirmation sheet shown before freezing a card. Freezing runs here — the
 * confirm button shows the pending state and the sheet closes on success.
 */
export const FreezeCardConfirmationSheet = () => {
    const { t } = useLanguage()
    const { isFreezing, onConfirm, onClose } = useFreezeCardConfirmationSheet()

    return (
        <CardConfirmationSheet
            header={<FrozenCardGlyph size='lg' />}
            title={t('peraCard.account.freeze_sheet_title')}
            body={t('peraCard.account.freeze_sheet_body')}
            confirmLabel={t('peraCard.account.freeze_sheet_confirm')}
            isPending={isFreezing}
            onConfirm={onConfirm}
            onClose={onClose}
            testID='freeze_card_confirmation_sheet'
            confirmTestID='freeze_confirm_button'
            closeTestID='freeze_close_button'
        />
    )
}
