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

import { useTheme } from '@rneui/themed'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon } from '@modules/chain-ui'
import { useStyles } from './styles'
import type { UseAccountNetworksResult } from './useAccountNetworks'
import { AccountNetworkRowView } from './AccountNetworkRowView'
import { UnreachableChainsNoteRow } from './UnreachableChainsNoteRow'

export type AccountNetworkListProps = {
    networks: UseAccountNetworksResult
    onClose: () => void
}

export const AccountNetworkList = ({
    networks,
    onClose,
}: AccountNetworkListProps) => {
    const { theme } = useTheme()
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.networkList}>
            {networks.visibleRows.map(row => (
                <AccountNetworkRowView
                    key={row.chainId}
                    row={row}
                    networks={networks}
                    onClose={onClose}
                />
            ))}
            {networks.hiddenRows.length > 0 && (
                <PWTouchableOpacity
                    style={styles.seeAllButton}
                    onPress={networks.handleShowAllNetworks}
                    testID='account_networks_see_all'
                >
                    <PWView style={styles.chainIconStack}>
                        {networks.hiddenRows.map((row, index) => (
                            <PWView
                                key={row.chainId}
                                style={index > 0 && styles.stackedChainIcon}
                            >
                                <ChainIcon
                                    chainId={row.chainId}
                                    size={theme.spacing.lg}
                                />
                            </PWView>
                        ))}
                    </PWView>
                    <PWText variant='h4'>
                        {t('account_options.see_all_networks')}
                    </PWText>
                    <PWIcon
                        name='chevron-down'
                        size='sm'
                    />
                </PWTouchableOpacity>
            )}
            {networks.unreachableChainsNote && (
                <UnreachableChainsNoteRow
                    note={networks.unreachableChainsNote}
                    account={networks.account}
                />
            )}
        </PWView>
    )
}
