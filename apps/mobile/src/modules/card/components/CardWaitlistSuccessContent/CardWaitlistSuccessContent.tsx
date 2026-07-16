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
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useStyles } from './styles'

type CardWaitlistSuccessContentProps = {
    /** Display name of the country the user signed up to be notified about. */
    countryName: string
}

/**
 * Confirms a successful waitlist sign-up for an unsupported jurisdiction. The
 * device will be notified via push when the country launches. The CTA resolves
 * `true` so the opener can send the user back home; swiping the sheet away just
 * closes it (resolves `undefined`).
 */
export const CardWaitlistSuccessContent = ({
    countryName,
}: CardWaitlistSuccessContentProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    const { resolve } = useBottomSheetResult<boolean>()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.iconWrap}>
                <PWIcon
                    name='bell'
                    size='xl'
                />
            </PWView>
            <PWText
                variant='h3'
                style={styles.title}
            >
                {t('peraCard.waitlist.success_title')}
            </PWText>
            <PWText style={styles.body}>
                {t('peraCard.waitlist.success_body', { country: countryName })}
            </PWText>
            <PWView style={styles.actions}>
                <PWButton
                    variant='primary'
                    onPress={() => resolve(true)}
                    title={t('peraCard.waitlist.success_action')}
                    testID='card-waitlist-success-dismiss'
                />
            </PWView>
        </PWView>
    )
}
