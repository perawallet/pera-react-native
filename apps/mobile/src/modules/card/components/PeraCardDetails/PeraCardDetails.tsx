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

import { CardIssuanceState } from '@perawallet/wallet-core-card'
import { PWScrollView, PWView } from '@components/core'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { CardFrozenBanner } from '../CardFrozenBanner'
import { PeraCardVisual } from './PeraCardVisual'
import { RevealCardDetailsButton } from './RevealCardDetailsButton'
import { CardFundingAccountSection } from './CardFundingAccountSection'
import { CardIssuanceNotice } from './CardIssuanceNotice'
import { CardOptionsSection } from './CardOptionsSection'
import { usePeraCardDetails } from './usePeraCardDetails'
import { useStyles } from './styles'

// Labels this caller in screen-capture logs; the native lock is shared.
const SCREEN_CAPTURE_TAG = 'pera-card-details'

export const PeraCardDetails = () => {
    const styles = useStyles()
    const {
        maskedPan,
        secureImageUrl,
        isCardOpen,
        isRevealing,
        onToggleReveal,
        onSecureImageLoad,
        onSecureImageError,
        fundingAddress,
        onChangeFunding,
        hasCard,
        issuanceState,
        onRetryOrder,
        onContactSupport,
        fundingTypeLabel,
        onChangeFundingType,
        isOffline,
        isFrozen,
        freezeLabel,
        isFreezing,
        canToggleFreeze,
        onToggleFreeze,
        onSetPin,
        isSettingPin,
        onAccountsDetails,
        walletPlatform,
        onAddToWallet,
        onReportLostStolen,
        onReportSuspicious,
    } = usePeraCardDetails()

    // Block screenshots/recording while the real PAN/CVV is (or is becoming)
    // visible, matching the other secure screens (passphrase, backup, import).
    usePreventScreenCapture(SCREEN_CAPTURE_TAG, isCardOpen || isRevealing)

    // Card-only affordances (reveal, PIN, freeze, reports, wallet
    // provisioning) exist only once the Baanx card does; before that the
    // issuance notice explains what the dimmed card is waiting on. Loading
    // stays undimmed and notice-free so card-holders get no flash on entry.
    const isReady = issuanceState === CardIssuanceState.Ready

    return (
        <PWScrollView contentContainerStyle={styles.content}>
            <CardFrozenBanner />

            <PWView style={styles.cardBlock}>
                <PeraCardVisual
                    maskedPan={maskedPan}
                    secureImageUrl={secureImageUrl ?? undefined}
                    isOpen={isCardOpen}
                    isDimmed={
                        !isReady && issuanceState !== CardIssuanceState.Loading
                    }
                    onSecureImageLoad={onSecureImageLoad}
                    onSecureImageError={onSecureImageError}
                />
                {isReady ? (
                    <RevealCardDetailsButton
                        isLoading={isRevealing}
                        // "Hide" only once the card is actually open; disabled while
                        // the first reveal loads, so the label is never a mismatch.
                        isRevealed={isCardOpen}
                        isDisabled={isOffline}
                        onPress={onToggleReveal}
                    />
                ) : (
                    <CardIssuanceNotice
                        state={issuanceState}
                        onRetryOrder={onRetryOrder}
                        onContactSupport={onContactSupport}
                    />
                )}
            </PWView>

            <CardFundingAccountSection
                address={fundingAddress}
                onChange={onChangeFunding}
                hasCard={hasCard}
                fundingTypeLabel={fundingTypeLabel}
                onChangeFundingType={onChangeFundingType}
            />

            <CardOptionsSection
                isFrozen={isFrozen}
                freezeLabel={freezeLabel}
                isFreezing={isFreezing}
                canToggleFreeze={canToggleFreeze}
                walletPlatform={walletPlatform}
                isSettingPin={isSettingPin}
                isOffline={isOffline}
                showCardActions={isReady}
                onAccountsDetails={onAccountsDetails}
                onAddToWallet={onAddToWallet}
                onSetPin={onSetPin}
                onToggleFreeze={onToggleFreeze}
                onReportLostStolen={onReportLostStolen}
                onReportSuspicious={onReportSuspicious}
            />
        </PWScrollView>
    )
}
