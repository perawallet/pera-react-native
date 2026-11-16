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

import FolderIcon from '@assets/icons/discover/folder.svg'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { DappLogoStack } from '../DappLogoStack'
import { useStyles } from './styles'

export type FolderRowProps = {
    name: string
    count: number
    /** The first dApps' logos, stacked before the count. */
    logos?: Nullable<string>[]
    /** \`folder\`: the design's folder glyph; \`star\`: the All favorites entry. */
    icon: 'folder' | 'star'
    onPress: () => void
    testID?: string
}

/** A favorites folder (or the All favorites entry): icon, name, logos and "N dApps", chevron. */
export const FolderRow = ({
    name,
    count,
    logos,
    icon,
    onPress,
    testID,
}: FolderRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWTouchableOpacity
            style={styles.row}
            onPress={onPress}
            testID={testID}
        >
            <PWView style={styles.icon}>
                {icon === 'folder' ? (
                    <FolderIcon />
                ) : (
                    <PWIcon
                        name='star'
                        variant='tertiary'
                    />
                )}
            </PWView>
            <PWView style={styles.info}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    numberOfLines={1}
                >
                    {name}
                </PWText>
                <PWView style={styles.countRow}>
                    {logos ? (
                        <DappLogoStack
                            logos={logos}
                            total={count}
                        />
                    ) : null}
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.count}
                    >
                        {t('discover.favorites.dapp_count', { count })}
                    </PWText>
                </PWView>
            </PWView>
            <PWView style={styles.chevron}>
                <PWIcon
                    name='chevron-right'
                    size='sm'
                    variant='tertiary'
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
