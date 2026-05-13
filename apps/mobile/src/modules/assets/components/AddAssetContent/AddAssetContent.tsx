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
import { useBottomSheet, useBottomSheetResult } from '@modules/bottom-sheet'
import { AddAssetView } from '@modules/assets/components/AddAssetView'
import { AsaVerificationInfoContent } from '@modules/assets/components/AsaVerificationInfoContent'
import { useStyles } from './styles'

export type AddAssetContentVariant = 'asset' | 'collectible'

export type AddAssetContentProps = {
    variant?: AddAssetContentVariant
}

export const AddAssetContent = ({
    variant = 'asset',
}: AddAssetContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()
    const { dismiss } = useBottomSheetResult<void>()

    const title =
        variant === 'collectible'
            ? t('add_asset.collectible_title')
            : t('add_asset.title')

    const handleOpenVerificationInfo = () => {
        void requestBottomSheet<void>({
            contents: <AsaVerificationInfoContent />,
            options: { size: 'lg', enablePanDownToClose: true },
        })
    }

    return (
        <>
            <PWView style={styles.header}>
                <PWTouchableOpacity
                    style={styles.headerAction}
                    onPress={dismiss}
                >
                    <PWIcon
                        name='cross'
                        size='md'
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
                    onPress={handleOpenVerificationInfo}
                >
                    <PWIcon
                        name='info'
                        size='sm'
                    />
                </PWTouchableOpacity>
            </PWView>
            <AddAssetView variant={variant} />
        </>
    )
}
