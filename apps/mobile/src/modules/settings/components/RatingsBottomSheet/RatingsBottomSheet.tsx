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

import { PWBottomSheet, PWText, PWView } from '@components/core'
import { useStyles } from './RatingsBottomSheet.style'
import RateApp, { AndroidMarket } from 'react-native-rate-app'
import { RoundButton } from '@components/RoundButton'
import { useLanguage } from '@hooks/useLanguage'
import { useDeviceInfoService } from '@perawallet/wallet-core-platform-integration'

type RatingsBottomSheetProps = {
    isOpen: boolean
    onClose: () => void
}

export const RatingsBottomSheet = (props: RatingsBottomSheetProps) => {
    const { isOpen, onClose } = props
    const styles = useStyles()
    const { t } = useLanguage()
    const deviceInfoService = useDeviceInfoService()

    const handleRatingClick = async () => {
        await RateApp.openStoreForReview({
            androidPackageName: deviceInfoService.getAppPackage(),
            iOSAppId: deviceInfoService.getAppId(),
            androidMarket: AndroidMarket.GOOGLE,
        })
        onClose()
    }

    return (
        <PWBottomSheet
            isVisible={isOpen}
            onBackdropPress={onClose}
            innerContainerStyle={styles.bottomSheetContainer}
        >
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
        </PWBottomSheet>
    )
}
