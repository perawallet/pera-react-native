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

import { useCallback, useEffect, useRef } from 'react'
import { isPasskeyUnlockEnabled } from '@perawallet/wallet-extension-keystore-chrome'
import {
    usePreferences,
    useSettingsStore,
} from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { waitForStoreHydration } from '../../../../bootstrap/waitForStoreHydration'
import {
    usePasskeyUnlockSetup,
    type PasskeyUnlockSetupStatus,
} from '../../components/PasskeyUnlockSetup/usePasskeyUnlockSetup.web'
import { usePasskeySetupStore } from '../../hooks/usePasskeySetupStore.web'

// Same ceiling the shell uses for the accounts store: a rejected rehydrate
// never fires onFinishHydration.
const SETTINGS_HYDRATION_TIMEOUT_MS = 2000

type UsePasskeyUnlockSetupScreenParams = { onDone: () => void }

type UsePasskeyUnlockSetupScreenResult = {
    status: PasskeyUnlockSetupStatus
    handleEnable: () => Promise<void>
    handleNotNow: () => Promise<void>
    handleContinue: () => Promise<void>
}

export const usePasskeyUnlockSetupScreen = ({
    onDone,
}: UsePasskeyUnlockSetupScreenParams): UsePasskeyUnlockSetupScreenResult => {
    const { status, enableWithSession, recordSkip } = usePasskeyUnlockSetup({
        screen: 'onboarding',
    })
    const setPending = usePasskeySetupStore(state => state.setPending)
    const { setPreference } = usePreferences()
    const hasProbedEnabledRef = useRef(false)

    // Closing the popup on the success view leaves the step pending. Offering
    // it again would run a second enrolment, which the stored credential's
    // exclusion turns into a false failure, so a satisfied step moves on.
    useEffect(() => {
        if (hasProbedEnabledRef.current) return
        hasProbedEnabledRef.current = true
        void isPasskeyUnlockEnabled().then(async isEnabled => {
            if (!isEnabled) return
            await setPending(false)
            onDone()
        })
    }, [setPending, onDone])

    const handleEnable = useCallback(
        (): Promise<void> => enableWithSession(),
        [enableWithSession],
    )

    const handleNotNow = useCallback(async (): Promise<void> => {
        recordSkip()
        // The step can be the first thing on screen after a popup reopen, and
        // a preference written before the store rehydrates is overwritten by it.
        await waitForStoreHydration(
            useSettingsStore,
            SETTINGS_HYDRATION_TIMEOUT_MS,
        )
        setPreference(UserPreferences._passkeyUnlockOfferPrompt, true)
        await setPending(false)
        onDone()
    }, [recordSkip, setPreference, setPending, onDone])

    const handleContinue = useCallback(async (): Promise<void> => {
        await setPending(false)
        onDone()
    }, [setPending, onDone])

    return { status, handleEnable, handleNotNow, handleContinue }
}
