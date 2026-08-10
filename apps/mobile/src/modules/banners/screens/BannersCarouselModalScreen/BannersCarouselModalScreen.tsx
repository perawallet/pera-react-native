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
import { BannerCarousel } from '@modules/banners/components/BannerCarousel'
import { PWIcon, PWScreen, PWTouchableOpacity, PWView } from '@components/core'
import { useBannersCarouselModalScreen } from './useBannersCarouselModalScreen'
import { useStyles } from './styles'

export const BannersCarouselModalScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const {
        banners,
        initialIndex,
        isDismissable,
        isClosable,
        onClose,
        onPressCTA,
        onDismiss,
    } = useBannersCarouselModalScreen()

    return (
        <PWScreen
            scroll='never'
            horizontalPadding='none'
            style={styles.root}
            testID='banners_carousel_modal'
        >
            <PWView style={styles.body}>
                <BannerCarousel
                    banners={banners}
                    initialIndex={initialIndex}
                    isDismissable={isDismissable}
                    onPressCTA={onPressCTA}
                    onDismiss={onDismiss}
                />
            </PWView>
            {isClosable ? (
                <PWTouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    testID='banners_carousel_modal_close'
                >
                    <PWIcon
                        name='cross'
                        size='sm'
                        variant='white'
                    />
                </PWTouchableOpacity>
            ) : null}
        </PWScreen>
    )
}
