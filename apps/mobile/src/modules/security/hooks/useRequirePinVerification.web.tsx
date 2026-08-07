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

// Web twin of the shared PIN gate.
//
// The native hook resolves TRUE when no PIN is configured — sound on mobile,
// where a PIN is part of onboarding. On the extension the lock is the vault
// password and a PIN is an optional, off-by-default extra, so that branch made
// the gate a no-op in the default configuration: the recovery passphrase was
// three clicks away on any unlocked profile, with no factor checked. This twin
// falls back to the vault password instead, so "no PIN" degrades to a
// different factor rather than to none.
import { useCallback } from 'react'
import { usePinCode } from '@perawallet/wallet-core-security'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useRequireVaultPassword } from '@modules/vault'
import { useLanguage } from '@hooks/useLanguage'
import { PinEditContent } from '../components/PinEditContent'
import { type UseRequirePinVerificationResult } from './useRequirePinVerification'

export type { UseRequirePinVerificationResult }

export const useRequirePinVerification =
    (): UseRequirePinVerificationResult => {
        const { checkPinEnabled } = usePinCode()
        const { request: requestBottomSheet } = useBottomSheet()
        const { requireVaultPassword } = useRequireVaultPassword()
        const { t } = useLanguage()

        const requirePinVerification = useCallback(async () => {
            if (await checkPinEnabled()) {
                const verified = await requestBottomSheet<boolean>({
                    contents: <PinEditContent mode='verify' />,
                    options: {
                        size: 'full',
                        enablePanDownToClose: false,
                        enableCloseOnBackdropPress: false,
                        autoCreateContainer: false,
                    },
                })
                return verified === true
            }
            return requireVaultPassword(t('vault.reauth.confirm_description'))
        }, [checkPinEnabled, requestBottomSheet, requireVaultPassword, t])

        return { requirePinVerification }
    }
