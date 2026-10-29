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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import {
    RekeyConfirmView,
    type RekeyConfirmCopy,
} from '@modules/rekey/components/RekeyConfirmView'
import { useRekeyToLedgerConfirmScreen } from './useRekeyToLedgerConfirmScreen'

const CONFIRM_COPY: RekeyConfirmCopy = {
    titleKey: i18nKey('rekey.to_ledger.confirm.title'),
    bodyKey: i18nKey('rekey.to_ledger.confirm.body'),
    learnMoreKey: i18nKey('rekey.to_ledger.confirm.learn_more'),
    currentAuthLabelKey: i18nKey('rekey.to_ledger.confirm.current_auth_label'),
    feeLabelKey: i18nKey('rekey.to_ledger.confirm.fee_label'),
    summaryLabelKey: i18nKey('rekey.to_ledger.confirm.summary_label'),
    ctaKey: i18nKey('rekey.to_ledger.confirm.cta'),
}

export const RekeyToLedgerConfirmScreen = () => {
    const { handleConfirmPress, ...rest } = useRekeyToLedgerConfirmScreen()

    return (
        <RekeyConfirmView
            {...rest}
            copy={CONFIRM_COPY}
            testIDPrefix='rekey-to-ledger'
            supportUrl={config.rekeyToLedgerSupportUrl}
            onConfirmPress={handleConfirmPress}
        />
    )
}
