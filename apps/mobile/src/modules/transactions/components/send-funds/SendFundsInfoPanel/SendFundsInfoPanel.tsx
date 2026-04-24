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
    type PWBottomSheetProps,
    PWButton,
    PWDivider,
    PWIcon,
    PWText,
    PWView,
} from '@components/core'
import { Trans } from 'react-i18next'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useSendFundsInfoPanel } from './useSendFundsInfoPanel'
import { useTheme } from '@rneui/themed'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export type SendFundsInfoPanelProps = {
    onClose: () => void
} & PWBottomSheetProps

export const SendFundsInfoPanel = ({
    isVisible,
    onClose,
    ...rest
}: SendFundsInfoPanelProps) => {
    const insets = useSafeAreaInsets()
    const { theme } = useTheme()
    const styles = useStyles({ insets })
    const { t } = useLanguage()
    const { forceOpen, handleOpenInfoLink, handleClose } =
        useSendFundsInfoPanel(onClose)

    return (
        <PWBottomSheet
            isVisible={isVisible || forceOpen}
            {...rest}
            innerContainerStyle={styles.container}
        >
            <PWIcon
                name='info'
                size='xxl'
                variant='helper'
            />
            <PWView style={styles.bodyContainer}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('send_funds.info.title')}
                </PWText>
                <PWText style={styles.preamble}>
                    {t('send_funds.info.preamble')}
                </PWText>
                <PWView style={styles.tipsContainer}>
                    <PWView style={styles.tip}>
                        <PWView style={styles.tipNumberContainer}>
                            <PWText
                                variant='h4'
                                style={styles.tipNumber}
                            >
                                1
                            </PWText>
                        </PWView>
                        <PWText style={styles.tipText}>
                            {t('send_funds.info.tip_1')}
                        </PWText>
                    </PWView>
                    <PWView style={styles.tip}>
                        <PWView style={styles.tipNumberContainer}>
                            <PWText
                                variant='h4'
                                style={styles.tipNumber}
                            >
                                2
                            </PWText>
                        </PWView>
                        <PWText style={styles.tipText}>
                            <Trans
                                i18nKey='send_funds.info.tip_2'
                                components={[
                                    <PWText
                                        key='warning'
                                        style={styles.redText}
                                    />,
                                ]}
                            />
                        </PWText>
                    </PWView>
                </PWView>
                <PWDivider color={theme.colors.layerGray} />
                <PWText
                    variant='bodyCompact'
                    style={styles.postamble}
                >
                    <Trans
                        i18nKey='send_funds.info.more_info'
                        components={[
                            <PWText
                                key='link'
                                variant='link'
                                style={styles.link}
                                onPress={handleOpenInfoLink}
                            />,
                        ]}
                    />
                </PWText>
                <PWButton
                    variant='secondary'
                    onPress={handleClose}
                    title={t('send_funds.info.i_understand')}
                />
            </PWView>
        </PWBottomSheet>
    )
}
