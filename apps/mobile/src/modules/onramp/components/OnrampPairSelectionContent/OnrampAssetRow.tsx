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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { getVerificationIcon } from '@modules/assets/utils/verification'
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { OnrampTokenIcon } from '../OnrampTokenIcon'
import { useStyles } from './styles'

// Verification tier mapping for known onramp tokens.
// RampToken has no tier field; we hardcode the known-safe tokens here and keep
// the mapping local — no tier is fabricated on the domain model.
const RAMP_TOKEN_VERIFICATION_TIER: Record<string, string> = {
    ALGO: 'trusted',
    USDC: 'verified',
    USDC_ALGORAND: 'verified',
}

type OnrampAssetRowProps = {
    token: RampToken
    onPress: () => void
}

export const OnrampAssetRow = ({ token, onPress }: OnrampAssetRowProps) => {
    const styles = useStyles()
    const verificationTier = RAMP_TOKEN_VERIFICATION_TIER[token.id] ?? null
    const verificationIcon = verificationTier
        ? getVerificationIcon(verificationTier)
        : null

    return (
        <PWTouchableOpacity
            onPress={onPress}
            testID={`onramp-asset-row-${token.id}`}
        >
            <PWView style={styles.row}>
                <OnrampTokenIcon
                    token={token}
                    size='md'
                    shape='circle'
                />
                <PWView style={styles.rowTextContainer}>
                    <PWView style={styles.rowNameRow}>
                        <PWText
                            variant='h4'
                            weight={700}
                            truncate
                        >
                            {token.name}
                        </PWText>
                        {verificationIcon && (
                            <PWIcon
                                name={verificationIcon}
                                size='xs'
                            />
                        )}
                    </PWView>
                    <PWText
                        variant='body'
                        truncate
                        style={styles.rowUnitName}
                    >
                        {token.symbol}
                    </PWText>
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}
