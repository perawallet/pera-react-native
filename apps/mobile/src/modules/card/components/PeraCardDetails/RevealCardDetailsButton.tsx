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

import { ActivityIndicator } from 'react-native'
import { PWIcon, PWText, PWTouchableOpacity } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type RevealCardDetailsButtonProps = {
    isLoading: boolean
    /** True once the secure details are showing — flips the label to "Hide". */
    isRevealed: boolean
    /** Disables the button without a spinner (e.g. offline-unsafe actions). */
    isDisabled?: boolean
    onPress: () => void
}

// No `eye-off` token exists, so the eye icon stays in both states; the label
// switches between Reveal/Hide to communicate the toggle.
export const RevealCardDetailsButton = ({
    isLoading,
    isRevealed,
    isDisabled = false,
    onPress,
}: RevealCardDetailsButtonProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={[styles.revealPill, isDisabled && styles.disabled]}
            onPress={onPress}
            disabled={isLoading || isDisabled}
            testID='pera_card_reveal_button'
        >
            {isLoading ? (
                <ActivityIndicator size='small' />
            ) : (
                <PWIcon
                    name='eye'
                    size='sm'
                    variant='secondary'
                />
            )}
            <PWText
                variant='footnoteMedium'
                style={styles.revealLabel}
            >
                {isRevealed
                    ? t('peraCard.account.hide_card_details')
                    : t('peraCard.account.reveal_card_details')}
            </PWText>
        </PWTouchableOpacity>
    )
}
