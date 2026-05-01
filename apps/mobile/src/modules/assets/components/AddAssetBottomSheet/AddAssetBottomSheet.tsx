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
import { useModalState } from '@hooks/useModalState'
import { AddAssetView } from '@modules/assets/components/AddAssetView'
import { AsaVerificationInfoBottomSheet } from '@modules/assets/components/AsaVerificationInfoBottomSheet'
import { useStyles } from './styles'

export type AddAssetBottomSheetVariant = 'asset' | 'collectible'

export type AddAssetBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    variant?: AddAssetBottomSheetVariant
}

export const AddAssetBottomSheet = ({
    isVisible,
    onClose,
    variant = 'asset',
}: AddAssetBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const verificationInfoState = useModalState(false)

    const title =
        variant === 'collectible'
            ? t('add_asset.collectible_title')
            : t('add_asset.title')

    return (
        <>
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
                        {title}
                    </PWText>
                    <PWTouchableOpacity
                        style={styles.headerAction}
                        onPress={verificationInfoState.open}
                    >
                        <PWIcon
                            name='info'
                            size='sm'
                        />
                    </PWTouchableOpacity>
                </PWView>
                <AddAssetView variant={variant} />
            </PWBottomSheet>

            <AsaVerificationInfoBottomSheet
                isVisible={verificationInfoState.isOpen}
                onClose={verificationInfoState.close}
            />
        </>
    )
}
