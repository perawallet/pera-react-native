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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { TokenizationStatus } from '@expensify/react-native-wallet'
import { useCardStore, useCardUserQuery } from '@perawallet/wallet-core-card'
import { useIsCardPushProvisioningEnabled } from '@hooks/useIsCardPushProvisioningEnabled'
import { isIOS } from '../../../platform/utils'
import {
    fetchAppleProvisioningPayload,
    fetchGoogleProvisioningPayload,
} from '../utils/provisioningPayload'
import {
    addCardToAppleWallet,
    addCardToGoogleWallet,
    checkWalletAvailability,
    getCardStatusBySuffix,
    isNativeWalletSupported,
} from '../utils/walletProvisioning'

// TODO(card): confirm the card network with Baanx before certification.
const CARD_NETWORK = 'MASTERCARD'
// Shown in the OS wallet sheet as the card's display name — a product name,
// deliberately not localised.
const CARD_DESCRIPTION = 'Pera Card'

const availabilityQueryKey = [
    'card',
    'wallet-provisioning',
    'availability',
] as const
const walletCardStatusQueryKey = (panLast4: string | null) =>
    ['card', 'wallet-provisioning', 'status', { panLast4 }] as const

export type AddCardToWalletOutcome = 'added' | 'dismissed' | 'fallback'

type UseAddCardToWalletResult = {
    /** The kill switch is on AND this device's OS wallet reports provisioning
     * is possible (which stays false until Pera holds the Apple entitlement /
     * Google allowlisting). */
    canPushProvision: boolean
    /** The card already lives in the OS wallet — the add entry point must be
     * hidden then (a Google certification requirement). */
    isCardInWallet: boolean
    /** Runs the native add flow. `fallback` means it couldn't run or complete
     * and the caller should show the manual instructions sheet; `dismissed`
     * means the user cancelled on purpose, so showing instructions would be
     * noise. */
    startAddCardToWallet: () => Promise<AddCardToWalletOutcome>
}

const startGoogleAdd = async (
    panLast4: string,
): Promise<TokenizationStatus> => {
    // Google needs the issuer's opaque payment card blob up front (unlike
    // Apple, where the issuer payload is requested mid-flow via callback).
    const payload = await fetchGoogleProvisioningPayload()
    return addCardToGoogleWallet({
        network: payload.network,
        opaquePaymentCard: payload.opaquePaymentCard,
        cardHolderName: payload.cardHolderName,
        lastDigits: panLast4,
        userAddress: payload.userAddress,
    })
}

export const useAddCardToWallet = (): UseAddCardToWalletResult => {
    const queryClient = useQueryClient()
    const isEnabled = useIsCardPushProvisioningEnabled()
    const panLast4 = useCardStore(state => state.lastKnownPanLast4)

    const availabilityQuery = useQuery({
        queryKey: availabilityQueryKey,
        queryFn: checkWalletAvailability,
        enabled: isEnabled && isNativeWalletSupported,
        // Availability flips with build entitlements/allowlisting, not at
        // runtime — one check per session is enough.
        staleTime: Infinity,
        retry: false,
    })
    const canPushProvision = isEnabled && (availabilityQuery.data ?? false)

    const walletCardStatusQuery = useQuery({
        queryKey: walletCardStatusQueryKey(panLast4),
        queryFn: () => getCardStatusBySuffix(panLast4 ?? ''),
        enabled: canPushProvision && panLast4 != null,
        retry: false,
    })
    const isCardInWallet = walletCardStatusQuery.data === 'active'

    // Gated so dormant builds never fire an extra user fetch from this hook —
    // the cardholder name is only needed once the native flow can actually run.
    const cardUser = useCardUserQuery({ enabled: canPushProvision })
    const cardHolderName = [cardUser.data?.firstName, cardUser.data?.lastName]
        .filter(Boolean)
        .join(' ')

    const startAddCardToWallet =
        useCallback(async (): Promise<AddCardToWalletOutcome> => {
            if (!canPushProvision || panLast4 == null) return 'fallback'
            try {
                const status = isIOS()
                    ? await addCardToAppleWallet(
                          {
                              network: CARD_NETWORK,
                              cardHolderName,
                              lastDigits: panLast4,
                              cardDescription: CARD_DESCRIPTION,
                          },
                          (nonce, nonceSignature, certificates) =>
                              fetchAppleProvisioningPayload({
                                  nonce,
                                  nonceSignature,
                                  certificates,
                              }),
                      )
                    : await startGoogleAdd(panLast4)
                if (status === 'success') {
                    // The OS wallet now holds the card — refresh the status so
                    // the add entry point hides.
                    void queryClient.invalidateQueries({
                        queryKey: walletCardStatusQueryKey(panLast4),
                    })
                    return 'added'
                }
                return status === 'canceled' ? 'dismissed' : 'fallback'
            } catch {
                // Payload endpoint missing, SDK not allowlisted, module not
                // linked… every failure routes to the manual instructions.
                return 'fallback'
            }
        }, [canPushProvision, panLast4, cardHolderName, queryClient])

    return {
        canPushProvision,
        isCardInWallet,
        startAddCardToWallet,
    }
}
