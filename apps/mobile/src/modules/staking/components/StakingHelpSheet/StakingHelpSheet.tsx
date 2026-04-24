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

import {
    PWBottomSheet,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { StakingType } from '../../models'
import { StakingTypeRow } from './StakingTypeRow'
import { useStyles } from './styles'

export type StakingHelpSheetProps = {
    isVisible: boolean
    onClose: () => void
}

const STAKING_TYPES: StakingType[] = ['liquid', 'pools', 'delegated']

export const StakingHelpSheet = ({
    isVisible,
    onClose,
}: StakingHelpSheetProps) => {
    const styles = useStyles({ isLast: false })
    const { t } = useLanguage()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            enablePanDownToClose
            testID='staking-help-sheet'
        >
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        variant='secondary'
                        onPress={onClose}
                        testID='staking-help-close-button'
                    />
                }
                center={
                    <PWText
                        variant='h4'
                        testID='staking-help-title'
                    >
                        {t('staking.help.title')}
                    </PWText>
                }
                paddingStyle='dense'
            />

            <PWView style={styles.contentContainer}>
                {STAKING_TYPES.map((type, index) => (
                    <StakingTypeRow
                        key={type}
                        type={type}
                        isLast={index === STAKING_TYPES.length - 1}
                        onClose={onClose}
                    />
                ))}
            </PWView>
        </PWBottomSheet>
    )
}
