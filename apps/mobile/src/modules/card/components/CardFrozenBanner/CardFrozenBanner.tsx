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

import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CardBadgeGlyph } from '../CardBadgeGlyph'
import { useCardFrozenBanner } from './useCardFrozenBanner'
import { useStyles } from './styles'

/**
 * Frozen-state notice shown atop both the Overview and Card Details tabs. Renders
 * nothing unless the card is frozen, so call sites can mount it unconditionally.
 */
export const CardFrozenBanner = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { isFrozen, isReactivating, onReactivate } = useCardFrozenBanner()

    if (!isFrozen) return null

    return (
        <PWView
            style={styles.banner}
            testID='card_frozen_banner'
        >
            <CardBadgeGlyph size='sm' />
            <PWView style={styles.content}>
                <PWView style={styles.textColumn}>
                    <PWText variant='h3'>
                        {t('peraCard.account.frozen_banner_title')}
                    </PWText>
                    <PWText
                        variant='body'
                        style={styles.body}
                    >
                        {t('peraCard.account.frozen_banner_body')}
                    </PWText>
                </PWView>
                <PWButton
                    variant='primary'
                    title={t('peraCard.account.reactivate_card')}
                    onPress={onReactivate}
                    isLoading={isReactivating}
                    testID='pera_card_reactivate_button'
                />
            </PWView>
        </PWView>
    )
}
