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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type SwapFormControlsProps = {
    onSwapPress: () => void
    onMaxPress: () => void
}

export const SwapFormControls = ({
    onSwapPress,
    onMaxPress,
}: SwapFormControlsProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.controlsRow}>
            <PWTouchableOpacity
                style={styles.swapDirectionButton}
                onPress={onSwapPress}
            >
                <PWIcon name='swap' />
            </PWTouchableOpacity>

            <PWView style={styles.maxRow}>
                <PWTouchableOpacity onPress={onMaxPress}>
                    <PWIcon name='sliders' />
                </PWTouchableOpacity>
                <PWTouchableOpacity
                    style={styles.maxButton}
                    onPress={onMaxPress}
                >
                    <PWText
                        variant='body'
                        style={styles.maxText}
                    >
                        {t('swap.form.max')}
                    </PWText>
                </PWTouchableOpacity>
            </PWView>
        </PWView>
    )
}
