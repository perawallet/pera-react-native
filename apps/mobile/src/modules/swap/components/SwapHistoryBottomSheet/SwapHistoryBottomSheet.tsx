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
import { SwapHistoryList } from '@modules/swap/components/SwapHistoryList'
import { useStyles } from './styles'

export type SwapHistoryBottomSheetProps = {
    isVisible: boolean
    address: string
    onClose: () => void
}

export const SwapHistoryBottomSheet = ({
    isVisible,
    address,
    onClose,
}: SwapHistoryBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            enablePanDownToClose
            size='lg'
            autoCreateContainer={false}
            testID='swap-history-bottom-sheet'
        >
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        variant='secondary'
                        onPress={onClose}
                    />
                }
                center={<PWText variant='h4'>{t('swap.history.title')}</PWText>}
                paddingStyle='dense'
            />
            <PWView style={styles.listWrapper}>
                <SwapHistoryList
                    address={address}
                    onClose={onClose}
                    inBottomSheet
                />
            </PWView>
        </PWBottomSheet>
    )
}
