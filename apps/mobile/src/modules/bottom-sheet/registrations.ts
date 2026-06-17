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

/**
 * Centralised registry of bottom sheets that need to be reachable by string
 * key — typically because they're opened from non-React code such as the
 * deep-link handler or a native event bridge.
 *
 * To add a new entry:
 *   1. Import the content component below.
 *   2. Call `registerBottomSheet('<your-key>', <YourContent>)`.
 *   3. Add the typed props to the `BottomSheetRegistry` augmentation block.
 *
 * Callers can then open the sheet via:
 *   useBottomSheetStore.getState().requestByType('<your-key>', { ...props })
 *
 * This file is imported once during app bootstrap from `RootComponent`, so
 * the runtime registrations bind before any deep link can fire.
 */

import { registerBottomSheet } from './registry/registry'
import { OptInConfirmationContent } from '@modules/assets/components/OptInConfirmationContent'
import { OptInAccountSelectionContent } from '@modules/assets/components/OptInAccountSelectionContent'
import { AccountActionsContent } from '@modules/accounts/components/AccountActionsContent'
import { SendFundsContent } from '@modules/transactions/components/send-funds/SendFundsContent'
import { BidaliContent } from '@modules/gift-card/components/BidaliContent'
import { PasskeyBiometricRequiredContent } from '@modules/settings/components/PasskeyBiometricRequiredContent'
import { PasskeyHDWalletRequiredContent } from '@modules/settings/components/PasskeyHDWalletRequiredContent'

registerBottomSheet('asset-opt-in', OptInConfirmationContent)
registerBottomSheet(
    'asset-opt-in-account-selection',
    OptInAccountSelectionContent,
)
registerBottomSheet('account-actions', AccountActionsContent)
registerBottomSheet('send-funds', SendFundsContent)
registerBottomSheet('bidali', BidaliContent)
registerBottomSheet(
    'passkey-biometric-required',
    PasskeyBiometricRequiredContent,
)
registerBottomSheet(
    'passkey-hd-wallet-required',
    PasskeyHDWalletRequiredContent,
)

declare module '@modules/bottom-sheet' {
    interface BottomSheetRegistry {
        'asset-opt-in': {
            assetId: string
            accountAddress: string
        }
        'asset-opt-in-account-selection': {
            highlightedAddress?: string
        }
        'account-actions': {
            address: string
            label?: string
        }
        'send-funds': {
            assetId?: string
        }
        // BidaliContent takes no props — it owns its own internal navigator
        // and account selection. Empty record keeps the registry typed.
        bidali: Record<string, never>
        // No props — the sheet is purely informational.
        'passkey-biometric-required': Record<string, never>
        'passkey-hd-wallet-required': Record<string, never>
    }
}

export {}
