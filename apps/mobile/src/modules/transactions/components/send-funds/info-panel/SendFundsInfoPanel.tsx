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

import PWBottomSheet, {
    PWBottomSheetProps,
} from '../../../../../components/bottom-sheet/PWBottomSheet'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { Text } from '@rneui/themed'
import { useEffect, useState } from 'react'
import PWIcon from '../../../../../components/icons/PWIcon'
import PWButton from '../../../../../components/button/PWButton'
import { UserPreferences } from '@constants/user-preferences'
import { useStyles } from './styles'
import PWView from '../../../../../components/view/PWView'
import { useLanguage } from '@hooks/language'

type SendFundsInfoPanelProps = {
    onClose: () => void
} & PWBottomSheetProps

const SendFundsInfoPanel = ({
    isVisible,
    onClose,
    ...rest
}: SendFundsInfoPanelProps) => {
    const styles = useStyles()
    const { getPreference, setPreference } = usePreferences()
    const [forceOpen, setForceOpen] = useState(false)
    const hasAgreed = getPreference(UserPreferences.spendAgreed)
    const { t } = useLanguage()

    useEffect(() => {
        if (!hasAgreed) {
            setTimeout(() => {
                setForceOpen(true)
            }, 300)
        } else {
            setForceOpen(false)
        }
    }, [hasAgreed])

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
                <Text
                    h3
                    h3Style={styles.title}
                >
                    {t('send_funds.info.title')}
                </Text>
                <Text style={styles.preamble}>
                    {t('send_funds.info.tip_1')}
                </Text>
                <PWView style={styles.tipsContainer}>
                    <PWView style={styles.tip}>
                        <PWView style={styles.tipNumberContainer}>
                            <Text style={styles.tipNumber}>1</Text>
                        </PWView>
                        <Text style={styles.tipText}>
                            {t('send_funds.info.tip_2')}
                        </Text>
                    </PWView>
                    <PWView style={styles.tip}>
                        <PWView style={styles.tipNumberContainer}>
                            <Text style={styles.tipNumber}>2</Text>
                        </PWView>
                        <Text style={styles.tipText}>
                            {t('send_funds.info.tip_3')}
                        </Text>
                    </PWView>
                </PWView>
                {/* TODO implement link */}
                <Text style={styles.postamble}>
                    For more information on transacting{' '}
                    <Text style={styles.link}>
                        {t('send_funds.info.tap_here')}
                    </Text>
                </Text>
                <PWButton
                    variant='secondary'
                    onPress={handleClose}
                    title={t('send_funds.info.i_understand')}
                />
            </PWView>
        </PWBottomSheet>
    )
}

export default SendFundsInfoPanel
