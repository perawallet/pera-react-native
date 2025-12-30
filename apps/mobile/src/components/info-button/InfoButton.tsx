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

import PWIcon, { PWIconSize } from '@components/icons/PWIcon'
import PWBottomSheet from '@components/bottom-sheet/PWBottomSheet'
import { useModalState } from '@hooks/modal-state'
import { PropsWithChildren } from 'react'
import { useStyles } from './styles'
import PWView from '@components/view/PWView'
import { Text } from '@rneui/themed'
import { useLanguage } from '@hooks/language'
import PWButton from '@components/button/PWButton'
import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'

type InfoButtonProps = {
    variant?: 'primary' | 'secondary'
    size?: PWIconSize
    title?: string
} & PropsWithChildren

const InfoButton = ({
    variant = 'secondary',
    size = 'sm',
    title,
    children,
}: InfoButtonProps) => {
    const bottomSheetState = useModalState()
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <>
            <PWTouchableOpacity
                style={styles.iconContainer}
                onPress={bottomSheetState.open}
            >
                <PWIcon
                    name='info'
                    variant={variant}
                    size={size}
                />
            </PWTouchableOpacity>
            <PWBottomSheet
                isVisible={bottomSheetState.isOpen}
                innerContainerStyle={styles.container}
            >
                {!!title && (
                    <Text
                        h3
                        h3Style={styles.title}
                    >
                        {title}
                    </Text>
                )}
                <PWView style={styles.contentContainer}>{children}</PWView>
                <PWButton
                    variant='secondary'
                    title={t('common.close.label')}
                    onPress={bottomSheetState.close}
                    style={styles.closeButton}
                />
            </PWBottomSheet>
        </>
    )
}

export default InfoButton
