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
import { useRekeyToStandardConfirmScreen } from './useRekeyToStandardConfirmScreen'

const CONFIRM_COPY: RekeyConfirmCopy = {
    titleKey: i18nKey('rekey.to_standard.confirm.title'),
    bodyKey: i18nKey('rekey.to_standard.confirm.body'),
    learnMoreKey: i18nKey('rekey.to_standard.confirm.learn_more'),
    currentAuthLabelKey: i18nKey(
        'rekey.to_standard.confirm.current_auth_label',
    ),
    feeLabelKey: i18nKey('rekey.to_standard.confirm.fee_label'),
    summaryLabelKey: i18nKey('rekey.to_standard.confirm.summary_label'),
    ctaKey: i18nKey('rekey.to_standard.confirm.cta'),
}

export const RekeyToStandardConfirmScreen = () => {
    const { handleConfirmPress, ...rest } = useRekeyToStandardConfirmScreen()

    return (
        <RekeyConfirmView
            {...rest}
            copy={CONFIRM_COPY}
            testIDPrefix='rekey-to-standard'
            supportUrl={config.rekeyToStandardSupportUrl}
            onConfirmPress={handleConfirmPress}
        />
    )
}
