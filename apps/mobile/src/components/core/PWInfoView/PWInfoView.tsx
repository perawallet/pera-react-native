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

import type { ReactNode } from 'react'
import { PWButton } from '@components/core/PWButton'
import { PWText } from '@components/core/PWText'
import { PWView } from '@components/core/PWView'
import { useStyles } from './styles'

export type PWInfoViewAction = {
    label: string
    onPress: () => void
    isLoading?: boolean
    isDisabled?: boolean
    testID?: string
}

export type PWInfoViewProps = {
    illustration?: ReactNode
    title: string
    body: string
    /**
     * Optional slot rendered in the footer above the primary action (e.g. a
     * warning row or a compliance message). Use this for anything that needs
     * to sit between the content and the button stack.
     */
    footerExtras?: ReactNode
    primaryAction: PWInfoViewAction
    secondaryAction?: PWInfoViewAction
    testID?: string
}

export const PWInfoView = ({
    illustration,
    title,
    body,
    footerExtras,
    primaryAction,
    secondaryAction,
    testID = 'pw-info-view',
}: PWInfoViewProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.root}
            testID={testID}
        >
            <PWView style={styles.content}>
                {illustration}
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {title}
                </PWText>
                <PWText
                    variant='h4'
                    style={styles.description}
                >
                    {body}
                </PWText>
            </PWView>

            <PWView style={styles.footer}>
                {footerExtras}
                <PWButton
                    variant='primary'
                    title={primaryAction.label}
                    onPress={primaryAction.onPress}
                    isLoading={primaryAction.isLoading}
                    isDisabled={primaryAction.isDisabled}
                    testID={primaryAction.testID ?? `${testID}-primary`}
                />
                {secondaryAction && (
                    <PWButton
                        variant='secondary'
                        title={secondaryAction.label}
                        onPress={secondaryAction.onPress}
                        isLoading={secondaryAction.isLoading}
                        isDisabled={secondaryAction.isDisabled}
                        testID={secondaryAction.testID ?? `${testID}-secondary`}
                    />
                )}
            </PWView>
        </PWView>
    )
}
