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

import { PWIcon, PWLoadingIndicator, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon } from '@modules/chain-ui'
import type { ScanNetwork } from '../useSearchAccountsScreen'
import { useStyles } from './styles'

export type ScanNetworkRowProps = {
    network: ScanNetwork
}

export const ScanNetworkRow = ({ network }: ScanNetworkRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isFailed = network.status === 'failed'

    return (
        <PWView
            style={styles.row}
            testID={`scan_network_${network.chainId}`}
        >
            <ChainIcon chainId={network.chainId} />
            <PWText style={styles.name}>{network.name}</PWText>
            <PWView style={styles.status}>
                {isFailed ? (
                    <PWIcon
                        name='error-circle'
                        variant='negative'
                        size='sm'
                    />
                ) : (
                    <PWLoadingIndicator size='sm' />
                )}
                <PWText
                    variant='body'
                    style={isFailed ? styles.failedText : styles.statusText}
                >
                    {isFailed
                        ? t('onboarding.searching_accounts.network_failed')
                        : t('onboarding.searching_accounts.network_checking')}
                </PWText>
            </PWView>
        </PWView>
    )
}
