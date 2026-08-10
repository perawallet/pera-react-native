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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type PasteFromClipboardRowProps = {
    address: string
    onPress: (address: string) => void
}

export const PasteFromClipboardRow = ({
    address,
    onPress,
}: PasteFromClipboardRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const handlePress = () => onPress(address)

    return (
        <PWTouchableOpacity
            style={styles.pasteRow}
            onPress={handlePress}
            testID='address_search_paste_from_clipboard'
        >
            <PWView style={styles.pasteRowText}>
                <PWText
                    variant='caption'
                    style={styles.pasteRowLabel}
                >
                    {t('address_entry.paste_from_clipboard')}
                </PWText>
                {/* Shown in full and allowed to wrap, matching native — a
                    truncated address is not verifiable by eye. */}
                <PWText variant='mono'>{address}</PWText>
            </PWView>
            <PWIcon
                name='copy'
                size='md'
            />
        </PWTouchableOpacity>
    )
}
