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

import { ChainIconStack } from '@modules/chain-ui/icon'
import { ProjectVerificationIcon } from '@modules/projects'
import {
    PWButton,
    PWIcon,
    PWImage,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { DiscoverDapp } from '../../types'
import { useStyles } from './styles'

export type DappRowProps = {
    dapp: DiscoverDapp
    subtitle: string
    isFavorite: boolean
    /** Callers pass their hook's `isVerified(dapp.url)`; the dApp itself carries no verification. */
    isVerified: boolean
    showChains: boolean
    onPress: () => void
    onToggleFavorite: () => void
    /** Shows a Details button that opens the dApp's details; left out where rows have none. */
    onDetailsPress?: () => void
    testID?: string
}

export const DappRow = ({
    dapp,
    subtitle,
    isFavorite,
    isVerified,
    showChains,
    onPress,
    onToggleFavorite,
    onDetailsPress,
    testID,
}: DappRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            style={styles.row}
            testID={testID}
        >
            <PWTouchableOpacity
                style={styles.main}
                onPress={onPress}
                testID={testID ? `${testID}_open` : undefined}
            >
                {dapp.logo ? (
                    <PWImage
                        source={{ uri: dapp.logo }}
                        style={styles.logo}
                    />
                ) : (
                    <PWView style={styles.logo}>
                        <PWIcon
                            name='globe'
                            variant='secondary'
                        />
                    </PWView>
                )}
                <PWView style={styles.info}>
                    <PWView style={styles.titleRow}>
                        <PWText
                            variant='h4'
                            numberOfLines={1}
                            style={styles.title}
                        >
                            {dapp.name}
                        </PWText>
                        {isVerified ? (
                            <ProjectVerificationIcon
                                tier='verified'
                                size='xs'
                                testID={
                                    testID ? `${testID}_verified` : undefined
                                }
                            />
                        ) : null}
                    </PWView>
                    <PWText
                        variant='caption'
                        numberOfLines={1}
                        style={styles.subtitle}
                    >
                        {subtitle}
                    </PWText>
                </PWView>
                {showChains && dapp.chains.length > 0 ? (
                    <ChainIconStack chainIds={dapp.chains} />
                ) : null}
            </PWTouchableOpacity>
            {onDetailsPress ? (
                <PWButton
                    variant='secondary'
                    paddingStyle='dense'
                    title={t('discover.dapps.details')}
                    onPress={onDetailsPress}
                    testID={testID ? `${testID}_details` : undefined}
                />
            ) : null}
            <PWTouchableOpacity
                style={styles.star}
                onPress={onToggleFavorite}
                accessibilityLabel={t(
                    isFavorite
                        ? 'discover.dapp_row.unfavorite'
                        : 'discover.dapp_row.favorite',
                )}
                testID={testID ? `${testID}_star` : undefined}
            >
                <PWIcon
                    name={isFavorite ? 'star-filled' : 'star'}
                    variant={isFavorite ? 'favorite' : 'secondary'}
                />
            </PWTouchableOpacity>
        </PWView>
    )
}
