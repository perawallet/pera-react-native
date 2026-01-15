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
    PWIcon,
    PWText,
    PWView,
} from '@components/core'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useEffect, useState } from 'react'
import { UserPreferences } from '@constants/user-preferences'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/language'
import { useWebView } from '@hooks/webview'
import { v7 as uuid } from 'uuid'
import { config } from '@perawallet/wallet-core-config'

export type SendFundsInfoPanelProps = {
    onClose: () => void
} & PWBottomSheetProps

export const SendFundsInfoPanel = ({
    isVisible,
    onClose,
    ...rest
}: SendFundsInfoPanelProps) => {
    const styles = useStyles()
    const { getPreference, setPreference } = usePreferences()
    const [forceOpen, setForceOpen] = useState(false)
    const hasAgreed = getPreference(UserPreferences.spendAgreed)
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    useEffect(() => {
        if (!hasAgreed) {
            setTimeout(() => {
                setForceOpen(true)
            }, 300)
        } else {
            setForceOpen(false)
        }
    }, [hasAgreed])

    const handleOpenInfoLink = () => {
        pushWebView({
            id: uuid(),
            url: config.sendFundsFaqUrl,
        })
    }

    const handleClose = () => {
        setPreference(UserPreferences.spendAgreed, true)
        onClose()
    }

    return (
        <PWBottomSheet
            isVisible={isVisible || forceOpen}
            {...rest}
            innerContainerStyle={styles.container}
        >
            <PWIcon
                name='info'
                size='xl'
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
                    {t('send_funds.info.tip_1')}
                </PWText>
                <PWView style={styles.tipsContainer}>
                    <PWView style={styles.tip}>
                        <PWView style={styles.tipNumberContainer}>
                            <PWText style={styles.tipNumber}>1</PWText>
                        </PWView>
                        <PWText style={styles.tipText}>
                            {t('send_funds.info.tip_2')}
                        </PWText>
                    </PWView>
                    <PWView style={styles.tip}>
                        <PWView style={styles.tipNumberContainer}>
                            <PWText style={styles.tipNumber}>2</PWText>
                        </PWView>
                        <PWText style={styles.tipText}>
                            {t('send_funds.info.tip_3')}
                        </PWText>
                    </PWView>
                </PWView>
                <PWText style={styles.postamble}>
                    For more information on transacting{' '}
                    <PWText
                        style={styles.link}
                        onPress={handleOpenInfoLink}
                    >
                        {t('send_funds.info.tap_here')}
                    </PWText>
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
