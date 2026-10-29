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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type SeeOtherOptionsButtonProps = {
    onPress: () => void
    testID: string
}

export const SeeOtherOptionsButton = ({
    onPress,
    testID,
}: SeeOtherOptionsButtonProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWTouchableOpacity
            style={styles.button}
            onPress={onPress}
            testID={testID}
        >
            <PWView style={styles.iconWrapper}>
                <PWIcon name='chevron-down' />
            </PWView>
            <PWText variant='h4'>
                {t('onboarding.add_account.see_other_options')}
            </PWText>
        </PWTouchableOpacity>
    )
}
