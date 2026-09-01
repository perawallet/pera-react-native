/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'
import RateApp, { AndroidMarket } from 'react-native-rate-app'
import { RoundButton } from '@components/RoundButton'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { usePeraProvider } from '@perawallet/wallet-extension-provider'

export type RatingsContentProps = Record<string, never>

export const RatingsContent = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const provider = usePeraProvider()
    const deviceInfoService = provider.deviceInfo
    const { showToast } = useToast()
    const { dismiss } = useBottomSheetResult<void>()

    const handleRatingClick = async () => {
        dismiss()
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
            // lanekeep-ignore-next-line pera/no-error-toast-in-catch reason: localized common.error copy preserved; no exception detail surfaced
            showToast({
                title: t('common.error.title'),
                body: t('common.error.body'),
                type: 'error',
            })
        }
    }

    return (
        <PWView
            style={styles.bottomSheetContainer}
            testID='settings_ratings_bottom_sheet'
        >
            <PWText
                variant='h3'
                style={styles.title}
                truncate
            >
                {t('settings.rating.title')}
            </PWText>
            <PWText
                style={styles.bottomSheetMessage}
                numberOfLines={2}
                ellipsizeMode='tail'
            >
                {t('settings.rating.body')}
            </PWText>
            <PWView style={styles.buttonContainer}>
                <RoundButton
                    icon='thumb_down'
                    size='xl'
                    onPress={() => void handleRatingClick()}
                />
                <RoundButton
                    icon='thumb_up'
                    size='xl'
                    onPress={() => void handleRatingClick()}
                />
            </PWView>
        </PWView>
    )
}
