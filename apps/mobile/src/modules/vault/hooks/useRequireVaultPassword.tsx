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

import React, { useCallback } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import { VaultPasswordPrompt } from '../components/VaultPasswordPrompt'

type UseRequireVaultPasswordResult = {
    /**
     * Prompts for the vault password and resolves true once it verifies,
     * false if the user dismisses. `description` names the action being
     * confirmed so the sheet doesn't ask for a password out of context.
     */
    requireVaultPassword: (description: string) => Promise<boolean>
}

/**
 * Vault-password gate for high-consequence actions on the extension.
 *
 * The counterpart to mobile's `useRequirePinVerification`, which is a no-op
 * whenever no PIN is configured — the default here, since the extension's lock
 * is the vault password and a PIN is optional. Relying on that gate alone left
 * actions like revealing the recovery phrase reachable with no factor at all
 * on an unlocked profile.
 */
export const useRequireVaultPassword = (): UseRequireVaultPasswordResult => {
    const { request: requestBottomSheet } = useBottomSheet()

    const requireVaultPassword = useCallback(
        async (description: string): Promise<boolean> => {
            const verified = await requestBottomSheet<boolean>({
                contents: <VaultPasswordPrompt description={description} />,
                options: {
                    size: 'auto',
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                },
            })
            return verified === true
        },
        [requestBottomSheet],
    )

    return { requireVaultPassword }
}
