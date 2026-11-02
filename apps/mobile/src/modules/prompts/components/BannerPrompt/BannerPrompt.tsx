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
import { PWIcon, PWTouchableOpacity, PWView } from '@components/core'
// Direct subpath, not the module barrel: the barrel deliberately excludes the
// carousel so screens that only want HomeBannersStrip don't drag it in. This
// surface genuinely renders banners, so it takes the carousel knowingly.
import { BannerCarousel } from '@modules/banners/carousel'
import type { PromptViewProps } from '@modules/prompts/models'
import { useStyles } from './styles'
import { useBannerPrompt, BANNER_PROMPT_ID } from './useBannerPrompt'

export { BANNER_PROMPT_ID }

/**
 * The banner surface, shown in the prompt overlay when a banner asks to open
 * itself. Same carousel the modal route renders for a deliberate tap on the
 * strip — a forced banner differs only in that it cannot be dismissed, not in
 * what it is.
 */
export const BannerPrompt = ({ onHide }: PromptViewProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)

    const { banners, isForced, shown, finish, handlePressCTA, handleDismiss } =
        useBannerPrompt({ onHide })

    if (!shown) return null

    return (
        <PWView style={styles.root}>
            <PWView style={styles.body}>
                <BannerCarousel
                    banners={banners}
                    onPressCTA={handlePressCTA}
                    onDismiss={handleDismiss}
                    isDismissable={!isForced}
                    testID={BANNER_PROMPT_ID}
                />
            </PWView>
            {/* A forced banner has no way out but its CTA — that is the point
                of forcing it. Everything else keeps the close affordance the
                carousel modal has always had. */}
            {isForced ? null : (
                <PWTouchableOpacity
                    style={styles.closeButton}
                    onPress={finish}
                    testID='banner_prompt_close'
                >
                    <PWIcon
                        name='cross'
                        size='sm'
                        variant='white'
                    />
                </PWTouchableOpacity>
            )}
        </PWView>
    )
}
