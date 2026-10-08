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

import { useEffect } from 'react'
import { AppState } from 'react-native'
import { applyAppStateToHardwareSessions } from '@perawallet/wallet-core-signing'
import { useLedgerSigningDriver } from './useLedgerSigningDriver'
import { useLedgerConnectionIssueDriver } from './useLedgerConnectionIssueDriver'
import { useSigningCompletedDriver } from './useSigningCompletedDriver'
import { useSignRequestDriver } from './useSignRequestDriver'
import { useTransactionRequestFAQDriver } from './useTransactionRequestFAQDriver'

/**
 * Owns the `AppState` subscription for the hardware-signing backgrounding
 * policy. The app layer subscribes here — where react-native
 * legitimately lives — and forwards each change to the signing package's
 * pure `applyAppStateToHardwareSessions`, so the logic package stays free of
 * react-native (which would otherwise force every signing dependent to parse
 * react-native in its tests). Mounted once via the app-root SigningOverlays.
 */
const useHardwareBackgroundPolicyDriver = () => {
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState =>
            applyAppStateToHardwareSessions(nextState),
        )
        return () => subscription.remove()
    }, [])
}

export const SigningOverlays = () => {
    useSignRequestDriver()
    useSigningCompletedDriver()
    useTransactionRequestFAQDriver()
    useLedgerSigningDriver()
    useLedgerConnectionIssueDriver()
    useHardwareBackgroundPolicyDriver()

    return null
}
