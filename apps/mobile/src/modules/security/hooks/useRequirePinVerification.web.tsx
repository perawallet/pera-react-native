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

// fallow-ignore-file re-export-cycle -- false positive: fallow's
// platform-suffix resolver matches the `./useRequirePinVerification` type
// re-export below back to this same `.web.tsx` file instead of the intended
// `useRequirePinVerification.ts` sibling (TypeScript itself resolves it
// correctly — `pnpm build` passes).

// Web twin of the shared PIN gate.
//
// The native hook resolves TRUE when no PIN is configured, which is sound on
// mobile where a PIN is part of onboarding. The extension's lock is the vault
// password and it has no PIN (routeCapabilities.pin is off), so this always asks
// for the password. A PIN written by an older build is ignored: web offers no
// way to manage or remove it.
import { useCallback } from 'react'
import { useRequireVaultPassword } from '@modules/vault'
import { useLanguage } from '@hooks/useLanguage'
import type { UseRequirePinVerificationResult } from './useRequirePinVerification'

export type { UseRequirePinVerificationResult }

export const useRequirePinVerification =
    (): UseRequirePinVerificationResult => {
        const { requireVaultPassword } = useRequireVaultPassword()
        const { t } = useLanguage()

        const requirePinVerification = useCallback(
            () => requireVaultPassword(t('vault.reauth.confirm_description')),
            [requireVaultPassword, t],
        )

        return { requirePinVerification }
    }
