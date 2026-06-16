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

import React, { type ReactNode } from 'react'
import {
    PWIcon,
    PWText,
    PWView,
    type IconName,
    type PWIconVariant,
} from '@components/core'
import { useStyles } from './styles'

type StatusChecklistRowProps = {
    icon: IconName
    iconVariant: PWIconVariant
    title: string
    body?: string
    /** Amber "Pending" pill shown above the title (documents row only). */
    pendingLabel?: string
    /** Dims the title for steps that aren't reachable yet. */
    isInactive?: boolean
    testID?: string
    /** Row-specific content rendered below the body, e.g. the details CTA. */
    children?: ReactNode
}

/** One row of the setup-status checklist — icon plus a stack of texts. */
export const StatusChecklistRow = ({
    icon,
    iconVariant,
    title,
    body,
    pendingLabel,
    isInactive = false,
    testID,
    children,
}: StatusChecklistRowProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.row}
            testID={testID}
        >
            <PWIcon
                name={icon}
                variant={iconVariant}
            />
            <PWView style={styles.rowTexts}>
                {pendingLabel ? (
                    <PWText
                        variant='footnoteMedium'
                        style={styles.pendingLabel}
                        testID='card-onboarding-status-pending-label'
                    >
                        {pendingLabel}
                    </PWText>
                ) : null}
                <PWText
                    variant='bodyLarge'
                    style={isInactive ? styles.inactiveTitle : undefined}
                >
                    {title}
                </PWText>
                {body ? (
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.rowBody}
                    >
                        {body}
                    </PWText>
                ) : null}
                {children}
            </PWView>
        </PWView>
    )
}
