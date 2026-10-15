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
import { useNavigation } from '@react-navigation/native'
import { type I18nKey, i18nKey } from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'

const PAIRING_STEP_KEYS: readonly I18nKey[] = [
    i18nKey('ledger.troubleshooting.pairing_step_1'),
    i18nKey('ledger.troubleshooting.pairing_step_2'),
    i18nKey('ledger.troubleshooting.pairing_step_3'),
]

const COMMON_ISSUE_KEYS: readonly I18nKey[] = [
    i18nKey('ledger.troubleshooting.issue_unlocked'),
    i18nKey('ledger.troubleshooting.issue_bluetooth'),
    i18nKey('ledger.troubleshooting.issue_permissions'),
    i18nKey('ledger.troubleshooting.issue_unsupported'),
]

type UseLedgerTroubleshootingScreenResult = {
    pairingStepKeys: readonly I18nKey[]
    commonIssueKeys: readonly I18nKey[]
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
