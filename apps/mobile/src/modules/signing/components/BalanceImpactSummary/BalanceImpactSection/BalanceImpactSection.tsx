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

import { PWText, PWView } from '@components/core'
import { BalanceImpactRow } from '../BalanceImpactRow'
import { type BalanceImpactItem } from '../useBalanceImpactSummary'
import { useStyles } from '../styles'

export type BalanceImpactSectionProps = {
    title: string
    items: BalanceImpactItem[]
}

export const BalanceImpactSection = ({
    title,
    items,
}: BalanceImpactSectionProps) => {
    const styles = useStyles()

    if (items.length === 0) {
        return null
    }

    return (
        <PWView style={styles.section}>
            <PWText
                variant='caption'
                style={styles.sectionTitle}
            >
                {title}
            </PWText>
            {items.map(item => (
                <BalanceImpactRow
                    key={`${title}-${item.assetId}`}
                    item={item}
                />
            ))}
        </PWView>
    )
}
