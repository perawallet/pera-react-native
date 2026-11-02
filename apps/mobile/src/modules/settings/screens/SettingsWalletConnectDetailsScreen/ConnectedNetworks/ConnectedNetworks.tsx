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
import { getIconPixelSize, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ChainIcon } from '@modules/chain-ui/icon'
import { type ConnectedNetworkLabel } from '../useSettingsWalletConnectDetailsScreen'
import { useStyles } from './styles'

export type ConnectedNetworksProps = {
    networks: ConnectedNetworkLabel[]
}

export const ConnectedNetworks = ({ networks }: ConnectedNetworksProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const textStyleFor = (tone: ConnectedNetworkLabel['tone']) => {
        if (tone === 'mainnet') return styles.mainnetText
        if (tone === 'testnet') return styles.testnetText
        return styles.otherNetworkText
    }

    return (
        <PWView style={styles.networkContainer}>
            {networks.map(network => (
                <PWView
                    key={network.key}
                    style={styles.networkItem}
                >
                    <ChainIcon
                        chainId={network.chainId}
                        size={getIconPixelSize(theme, 'xs')}
                    />
                    <PWText style={textStyleFor(network.tone)}>
                        {t('walletconnect.settings.network_label', {
                            chain: network.chainName,
                            network: network.label,
                        })}
                    </PWText>
                </PWView>
            ))}
        </PWView>
    )
}
