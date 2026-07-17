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

import React from 'react'
import { PWLoadingOverlay } from '@components/core'
import { useVaultLockState } from '../../hooks/useVaultLockState'
import { UnlockScreen } from '../UnlockScreen'

type VaultGateProps = { children: React.ReactNode }

/**
 * Outermost lock gate (fail-closed): while lock state is unresolved nothing
 * renders but a loading view; a vault that exists and is locked renders ONLY
 * the unlock screen. Uninitialized vaults pass through — the shell routes
 * them to CreatePasswordScreen.
 */
export const VaultGate = ({ children }: VaultGateProps): React.JSX.Element => {
    const { isInitialized, isUnlocked } = useVaultLockState()

    if (isInitialized === null || isUnlocked === null) {
        return <PWLoadingOverlay isVisible={true} />
    }
    if (isInitialized && !isUnlocked) {
        return <UnlockScreen />
    }
    return <>{children}</>
}
