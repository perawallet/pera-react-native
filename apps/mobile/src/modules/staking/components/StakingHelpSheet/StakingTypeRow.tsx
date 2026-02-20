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

import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { StakingType } from '../../models'
import { StakingTypeBadge } from '../StakingTypeBadge'
import { useStyles } from './styles'

const STAKING_TYPE_DESCRIPTION_KEYS: Record<StakingType, string> = {
    liquid: 'staking.help.liquid_description',
    pools: 'staking.help.pools_description',
    delegated: 'staking.help.delegated_description',
}

type StakingTypeRowProps = {
    type: StakingType
    isLast: boolean
}

export const StakingTypeRow = ({ type, isLast }: StakingTypeRowProps) => {
    const styles = useStyles({ isLast })
    const { t } = useLanguage()

    return (
        <PWView style={styles.stakingTypeRow}>
            <PWView style={styles.stakingTypeHeader}>
                <StakingTypeBadge type={type} />
            </PWView>
            <PWText
                variant='body'
                style={styles.stakingTypeDescription}
            >
                {t(STAKING_TYPE_DESCRIPTION_KEYS[type])}
            </PWText>
        </PWView>
    )
}
