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

import {
    PWIcon,
    PWSheetLayout,
    PWText,
    bottomSheetNotifier,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'

export type RecipientAddressContentProps = {
    address: string
}

export const RecipientAddressContent = ({
    address,
}: RecipientAddressContentProps) => {
    const { t } = useLanguage()
    const { copyToClipboard } = useClipboard()

    const handleCopy = () => {
        void copyToClipboard(address, {
            notifier: bottomSheetNotifier.current ?? undefined,
        })
    }

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('send_funds.confirmation.to')}
                    rightAction={
                        <PWIcon
                            name='copy'
                            variant='secondary'
                            onPress={handleCopy}
                            accessibilityLabel={t('common.copy')}
                            testID='send_confirm_recipient_copy'
                        />
                    }
                />
            }
        >
            <PWText
                selectable
                testID='send_confirm_recipient_full_address'
            >
                {address}
            </PWText>
        </PWSheetLayout>
    )
}
