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

import type { ReactNode } from 'react'
import { PWIcon, PWText, PWView, type IconName } from '@components/core'
import { useStyles } from './styles'

export type CautionCardProps = {
    title?: string
    /** A string renders as body copy; a node renders as given. */
    message?: ReactNode
    icon?: IconName
    /** Red rather than amber: the review expects this to fail or cost the user. */
    isHighRisk?: boolean
    children?: ReactNode
    testID?: string
}

export const CautionCard = ({
    title,
    message,
    icon = 'shield-warning',
    isHighRisk = false,
    children,
    testID,
}: CautionCardProps) => {
    const styles = useStyles({ isHighRisk })

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWIcon
                name={icon}
                size='sm'
                variant={isHighRisk ? 'error' : 'warning'}
                style={styles.icon}
            />
            <PWView style={styles.content}>
                {!!title && (
                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        {title}
                    </PWText>
                )}
                {typeof message === 'string' ? (
                    <PWText style={styles.message}>{message}</PWText>
                ) : (
                    message
                )}
                {children}
            </PWView>
        </PWView>
    )
}
