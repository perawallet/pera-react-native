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

import { useStyles } from './styles'
import { PWButton, PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { AssetChainSectionProps } from '@modules/assets'
import { useAssetVerificationCard } from './useAssetVerificationCard'

export type AssetVerificationCardProps = AssetChainSectionProps

export const AssetVerificationCard = ({
    asset,
    scope,
}: AssetVerificationCardProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        isVisible,
        cardConfig,
        containerStyle,
        textStyle,
        handleLearnMore,
    } = useAssetVerificationCard({ asset, scope })

    if (!isVisible) {
        return null
    }

    return (
        <PWView style={styles.wrapper}>
            <PWView style={[styles.container, containerStyle]}>
                <PWIcon
                    name={cardConfig.icon}
                    size='md'
                    style={styles.icon}
                />
                <PWView style={styles.content}>
                    <PWText
                        variant='h4'
                        style={textStyle}
                    >
                        {cardConfig.title}
                    </PWText>
                    <PWText style={textStyle}>{cardConfig.description}</PWText>
                </PWView>
            </PWView>
            <PWButton
                variant='link'
                icon='info'
                title={t('asset_details.verification_card.learn_more')}
                onPress={handleLearnMore}
            />
        </PWView>
    )
}
