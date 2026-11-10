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
import { getIconPixelSize, PWBadge, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon } from '@modules/chain-ui/icon'
import type { RequestedNetwork } from '../useConnectionApprovalView'
import { useStyles } from './styles'

type RequestedNetworkChipProps = {
    network: RequestedNetwork
}

export const RequestedNetworkChip = ({
    network,
}: RequestedNetworkChipProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { chainId, name, isTestnet } = network

    return (
        <PWView
            style={styles.container}
            testID={`wc_requested_network_${chainId}`}
        >
            <ChainIcon
                chainId={chainId}
                size={getIconPixelSize(theme, 'xs')}
            />
            <PWText
                variant='caption'
                numberOfLines={1}
            >
                {name}
            </PWText>
            {isTestnet && (
                <PWBadge
                    variant='testnet'
                    value={t('walletconnect.request.networks_testnet')}
                />
            )}
        </PWView>
    )
}
