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

type SwapFormControlsProps = {
    onSwapPress: () => void
    onMaxPress: () => void
    onConfigurePress: () => void
    /** A cross-chain pair can't flip: the account pays only from its swap scope. */
    isDirectionDisabled?: boolean
}

export const SwapFormControls = ({
    onSwapPress,
    onMaxPress,
    onConfigurePress,
    isDirectionDisabled = false,
}: SwapFormControlsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.controlsRow}>
            <PWTouchableOpacity
                style={styles.swapDirectionButton}
                onPress={onSwapPress}
                disabled={isDirectionDisabled}
                testID='swap-flip-button'
            >
                <PWIcon
                    name='swap'
                    size='sm'
                    style={styles.swapDirectionIcon}
                    disabled={isDirectionDisabled}
                />
            </PWTouchableOpacity>

            <PWView style={styles.maxRow}>
                <PWTouchableOpacity
                    style={styles.maxIconContainer}
                    onPress={onConfigurePress}
                    testID='swap-configure-button'
                >
                    <PWIcon
                        name='sliders'
                        size='sm'
                        variant='positive'
                    />
                </PWTouchableOpacity>
                <PWView style={styles.maxDivider} />
                <PWTouchableOpacity
                    style={styles.maxButton}
                    onPress={onMaxPress}
                    testID='swap-max-button'
                >
                    <PWText
                        variant='linkPositive'
                        style={styles.maxText}
                    >
                        {t('swap.form.max')}
                    </PWText>
                </PWTouchableOpacity>
            </PWView>
        </PWView>
    )
}
