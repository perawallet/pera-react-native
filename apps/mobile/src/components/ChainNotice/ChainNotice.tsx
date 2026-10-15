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

import type { StyleProp, ViewStyle } from 'react-native'
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type ChainNoticeKind = 'warning' | 'error'

export type ChainNoticeAction = {
    labelKey: string
    onPress: () => void
}

/**
 * A chain-specific state the Algorand flows never had to render (pending,
 * failed, replaced, …). Takes keys rather than copy because they arrive as
 * data from a chain package's summary.
 */
export type ChainNoticeProps = {
    kind: ChainNoticeKind
    titleKey: string
    params?: Record<string, string>
    action?: ChainNoticeAction
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const ChainNotice = ({
    kind,
    titleKey,
    params,
    action,
    style,
    testID,
}: ChainNoticeProps) => {
    const styles = useStyles({ kind })
    const { t } = useLanguage()

    return (
        <PWView
            style={[styles.container, style]}
            testID={testID}
        >
            <PWIcon
                name={kind === 'error' ? 'error-circle' : 'warning'}
                size='sm'
                variant={kind}
            />
            <PWText
                variant='caption'
                style={styles.title}
            >
                {t(titleKey, params)}
            </PWText>
            {action && (
                <PWButton
                    variant='link'
                    paddingStyle='none'
                    title={t(action.labelKey)}
                    onPress={action.onPress}
                />
            )}
        </PWView>
    )
}
