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

import { PWText, PWView } from '@components/core'
import { useStyles } from './RatingsBottomSheet.style'
import RateApp, { AndroidMarket } from 'react-native-rate-app'
import { RoundButton } from '@components/RoundButton'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'

export type RatingsContentProps = {
    onClose: () => void
}

export const RatingsContent = ({ onClose }: RatingsContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const provider = usePeraProvider()
    const deviceInfoService = provider.deviceInfo
    const { showToast } = useToast()

    const handleRatingClick = async () => {
        onClose()
        try {
            const success = await RateApp.openStoreForReview({
                androidPackageName: deviceInfoService.getAppPackage(),
                iOSAppId: deviceInfoService.getAppId(),
                androidMarket: AndroidMarket.GOOGLE,
            })

            if (!success) {
                throw new Error('Failed to open store for review')
            }
        } catch {
            showToast({
                title: t('common.error.title'),
                body: t('common.error.body'),
                type: 'error',
            })
        }
    }

    return (
        <PWView style={styles.bottomSheetContainer}>
            <PWView style={styles.buttonContainer}>
                <RoundButton
                    icon='thumb_up'
                    onPress={handleRatingClick}
                />
                <RoundButton
                    icon='thumb_down'
                    onPress={handleRatingClick}
                />
            </PWView>
            <PWText variant='h3'>{t('settings.rating.title')}</PWText>
            <PWText style={styles.bottomSheetMessage}>
                {t('settings.rating.body')}
            </PWText>
        </PWView>
    )
}
