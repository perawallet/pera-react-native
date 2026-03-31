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
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { AddAssetScreen } from '@modules/assets/screens/AddAssetScreen'
import { useStyles } from './styles'

export type AddAssetBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
}

export const AddAssetBottomSheet = ({
    isVisible,
    onClose,
}: AddAssetBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
            size='lg'
            enablePanDownToClose
            autoCreateContainer={false}
        >
            <PWView style={styles.header}>
                <PWTouchableOpacity
                    style={styles.headerAction}
                    onPress={onClose}
                >
                    <PWIcon
                        name='cross'
                        size='sm'
                    />
                </PWTouchableOpacity>
                <PWText
                    variant='h4'
                    style={styles.headerTitle}
                >
                    {t('add_asset.title')}
                </PWText>
                <PWView style={styles.headerAction} />
            </PWView>
            <AddAssetScreen />
        </PWBottomSheet>
    )
}
