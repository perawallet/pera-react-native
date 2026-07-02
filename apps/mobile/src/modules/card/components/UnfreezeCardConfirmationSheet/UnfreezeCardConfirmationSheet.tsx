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
import { useUnfreezeCardConfirmationSheet } from './useUnfreezeCardConfirmationSheet'

/**
 * Confirmation sheet shown before unfreezing a card. Unfreezing runs here —
 * the confirm button shows the pending state and the sheet closes on success.
 */
export const UnfreezeCardConfirmationSheet = () => {
    const { t } = useLanguage()
    const { isUnfreezing, onConfirm, onClose } =
        useUnfreezeCardConfirmationSheet()

    return (
        <CardConfirmationSheet
            header={<FrozenCardGlyph size='lg' />}
            title={t('peraCard.account.unfreeze_sheet_title')}
            body={t('peraCard.account.unfreeze_sheet_body')}
            confirmLabel={t('peraCard.account.unfreeze_sheet_confirm')}
            isPending={isUnfreezing}
            onConfirm={onConfirm}
            onClose={onClose}
            testID='unfreeze_card_confirmation_sheet'
            confirmTestID='unfreeze_confirm_button'
            closeTestID='unfreeze_close_button'
        />
    )
}
