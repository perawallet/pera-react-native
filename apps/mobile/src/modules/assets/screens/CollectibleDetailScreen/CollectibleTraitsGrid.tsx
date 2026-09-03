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

import React from 'react'
import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { CollectibleTrait } from '@perawallet/wallet-core-assets'
import { useStyles } from './styles'

type CollectibleTraitsGridProps = {
    traits: CollectibleTrait[]
}

export const CollectibleTraitsGrid = ({
    traits,
}: CollectibleTraitsGridProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    if (!traits.length) {
        return null
    }

    return (
        <PWView>
            <PWText
                variant='h4'
                style={styles.sectionTitle}
            >
                {t('asset_details.collectible.properties')}
            </PWText>
            <PWView style={styles.traitsContainer}>
                {traits.map((trait, index) => (
                    <PWView
                        key={index}
                        style={styles.traitItem}
                    >
                        {trait.displayName && (
                            <PWText
                                variant='caption'
                                style={styles.traitLabel}
                            >
                                {trait.displayName}
                            </PWText>
                        )}
                        <PWText variant='body'>{trait.displayValue}</PWText>
                    </PWView>
                ))}
            </PWView>
        </PWView>
    )
}
