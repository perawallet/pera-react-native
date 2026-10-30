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

import { useCallback } from 'react'
import { useTheme } from '@rneui/themed'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    getIconPixelSize,
    PWBadge,
    PWButton,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon } from '@modules/chain-ui/icon'
import type { RequestedNetwork } from '../useConnectionApprovalView'
import { useStyles } from './styles'

export type RequestedNetworkChipProps = {
    network: RequestedNetwork
    onAdd: (chainId: ChainId) => void
}

export const RequestedNetworkChip = ({
    network,
    onAdd,
}: RequestedNetworkChipProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { chainId, name, isAdded, canAdd, isAdding, isTestnet } = network
    const handleAdd = useCallback(() => onAdd(chainId), [onAdd, chainId])

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
            {!isAdded && (
                <PWText
                    variant='caption'
                    style={styles.notAdded}
                >
                    {t('walletconnect.request.network_not_added')}
                </PWText>
            )}
            {canAdd && (
                <PWButton
                    variant='link'
                    title={t('account_options.add_network')}
                    onPress={handleAdd}
                    isLoading={isAdding}
                    testID={`wc_add_network_${chainId}`}
                />
            )}
        </PWView>
    )
}
