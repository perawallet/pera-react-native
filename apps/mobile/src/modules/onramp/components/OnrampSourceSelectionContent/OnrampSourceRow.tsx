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

import { PWImage, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CircleFlag } from '@components/CircleFlag'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { OnrampTokenIcon } from '../OnrampTokenIcon'
import { countryNameFromCode } from './countryNames'
import { useStyles } from './styles'
import { useTheme } from '@rneui/themed'

type OnrampSourceRowProps = {
    token: RampToken
    isFiat: boolean
    /** Overlay the network logo on the icon (for same-ticker tokens on
     *  different networks, e.g. USDC on Solana vs Base). */
    showNetworkBadge?: boolean
    onPress: () => void
}

export const OnrampSourceRow = ({
    token,
    isFiat,
    showNetworkBadge = false,
    onPress,
}: OnrampSourceRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { theme } = useTheme()

    const flagCountryCode = isFiat ? token.countryCode : undefined

    // Fiat sub-line: the country name (derived from the ISO code), falling back
    // to the token name. Crypto sub-line: "{symbol} · {network} network".
    const subLine = isFiat
        ? (token.countryCode && countryNameFromCode(token.countryCode)) ||
          token.name
        : t('onramp.source_selection.network_suffix', {
              symbol: token.symbol,
              network: token.network.name,
          })

    return (
        <PWTouchableOpacity
            onPress={onPress}
            testID={`onramp-source-row-${token.id}`}
        >
            <PWView style={styles.row}>
                {flagCountryCode ? (
                    <CircleFlag
                        countryCode={flagCountryCode}
                        size='xl'
                    />
                ) : (
                    <PWView style={styles.iconContainer}>
                        <OnrampTokenIcon
                            token={token}
                            size='xl'
                            shape='circle'
                        />
                        {showNetworkBadge && !!token.network.logo && (
                            <PWImage
                                source={{ uri: token.network.logo }}
                                style={styles.networkBadge}
                                width={theme.spacing.xl}
                                height={theme.spacing.xl}
                            />
                        )}
                    </PWView>
                )}
                <PWView style={styles.rowTextContainer}>
                    <PWText
                        variant='bodyLarge'
                        weight={500}
                        truncate
                    >
                        {token.name}
                    </PWText>
                    <PWText
                        variant='footnoteMedium'
                        truncate
                        style={styles.rowSubLine}
                    >
                        {subLine}
                    </PWText>
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}
