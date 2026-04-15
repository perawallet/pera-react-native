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

import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useLanguage } from '@hooks/useLanguage'

export const PAIRING_STEP_KEYS = [
    'ledger.troubleshooting.pairing_step_1',
    'ledger.troubleshooting.pairing_step_2',
    'ledger.troubleshooting.pairing_step_3',
] as const

export const COMMON_ISSUE_KEYS = [
    'ledger.troubleshooting.issue_unlocked',
    'ledger.troubleshooting.issue_bluetooth',
    'ledger.troubleshooting.issue_permissions',
    'ledger.troubleshooting.issue_unsupported',
] as const

type UseLedgerTroubleshootingScreenResult = {
    pairingStepKeys: readonly string[]
    commonIssueKeys: readonly string[]
    handleDone: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerTroubleshootingScreen =
    (): UseLedgerTroubleshootingScreenResult => {
        const { t } = useLanguage()
        const navigation = useNavigation()

        const handleDone = useCallback(() => {
            navigation.goBack()
        }, [navigation])

        return {
            pairingStepKeys: PAIRING_STEP_KEYS,
            commonIssueKeys: COMMON_ISSUE_KEYS,
            handleDone,
            t,
        }
    }
