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

import { PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { OnrampStatus } from '@perawallet/wallet-core-onramp'
import type { TypographyVariant } from '@theme/typography'
import { getOnrampStatusDescriptor } from '../OnrampStatusBadge'
import { useStyles } from './styles'

export type OnrampOrderStatusProps = {
    status: OnrampStatus
    /** Text size — `caption` for list rows, `bodySemibold` for sheet headers. */
    textVariant?: TypographyVariant
}

/** Inline status indicator (icon + colored label) shared by the history list
 *  rows and the order-details sheet. */
export const OnrampOrderStatus = ({
    status,
    textVariant = 'bodySemibold',
}: OnrampOrderStatusProps) => {
    const { t } = useLanguage()
    const { icon, iconVariant, color, labelKey } =
        getOnrampStatusDescriptor(status)
    const styles = useStyles({ statusColor: color })

    return (
        <PWView style={styles.row}>
            {icon !== null && (
                <PWIcon
                    name={icon}
                    size='sm'
                    variant={iconVariant}
                />
            )}
            <PWText
                variant={textVariant}
                style={styles.label}
            >
                {t(labelKey)}
            </PWText>
        </PWView>
    )
}
