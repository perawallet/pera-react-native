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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { PWIcon, PWLoadingIndicator, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon } from '@modules/chain-ui'
import type { ScanNetwork, ScanNetworkStatus } from '../useSearchAccountsScreen'
import { useStyles } from './styles'

const STATUS_LABEL_KEYS: Record<ScanNetworkStatus, I18nKey> = {
    checking: i18nKey('onboarding.searching_accounts.network_checking'),
    failed: i18nKey('onboarding.searching_accounts.network_failed'),
    unavailable: i18nKey('onboarding.searching_accounts.network_unavailable'),
}

export type ScanNetworkRowProps = {
    network: ScanNetwork
}

export const ScanNetworkRow = ({ network }: ScanNetworkRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isFailed = network.status === 'failed'
    const isUnavailable = network.status === 'unavailable'

    return (
        <PWView
            style={styles.row}
            testID={`scan_network_${network.chainId}`}
        >
            <ChainIcon chainId={network.chainId} />
            <PWText style={styles.name}>{network.name}</PWText>
            <PWView style={styles.status}>
                {isFailed && (
                    <PWIcon
                        name='error-circle'
                        variant='negative'
                        size='sm'
                    />
                )}
                {isUnavailable && (
                    <PWIcon
                        name='info'
                        variant='secondary'
                        size='sm'
                    />
                )}
                {!isFailed && !isUnavailable && (
                    <PWLoadingIndicator size='sm' />
                )}
                <PWText
                    variant='body'
                    style={isFailed ? styles.failedText : styles.statusText}
                >
                    {t(STATUS_LABEL_KEYS[network.status])}
                </PWText>
            </PWView>
        </PWView>
    )
}
