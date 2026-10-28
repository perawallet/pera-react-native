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

import { useMemo } from 'react'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { LedgerTransportType } from '@perawallet/wallet-core-hardware-wallet'

export type UseLedgerTransportOptionsContentParams = {
    isBleAvailable: boolean
    isUsbAvailable: boolean
}

export type LedgerTransportOption = {
    transport: LedgerTransportType
    testID: string
    titleKey: I18nKey
    descriptionKey: I18nKey
    isDisabled: boolean
}

export type UseLedgerTransportOptionsContentResult = {
    options: LedgerTransportOption[]
}

const UNSUPPORTED_DESCRIPTION_KEY = i18nKey(
    'onboarding.import_account_options.pair_ledger_unsupported_description',
)

export const useLedgerTransportOptionsContent = ({
    isBleAvailable,
    isUsbAvailable,
}: UseLedgerTransportOptionsContentParams): UseLedgerTransportOptionsContentResult => {
    const options = useMemo(
        (): LedgerTransportOption[] => [
            {
                transport: 'ble',
                testID: 'ledger_transport_options_ble_button',
                titleKey: i18nKey(
                    'onboarding.ledger_transport_options.ble_title',
                ),
                descriptionKey: isBleAvailable
                    ? i18nKey(
                          'onboarding.ledger_transport_options.ble_description',
                      )
                    : UNSUPPORTED_DESCRIPTION_KEY,
                isDisabled: !isBleAvailable,
            },
            {
                transport: 'usb',
                testID: 'ledger_transport_options_usb_button',
                titleKey: i18nKey(
                    'onboarding.ledger_transport_options.usb_title',
                ),
                descriptionKey: isUsbAvailable
                    ? i18nKey(
                          'onboarding.ledger_transport_options.usb_description',
                      )
                    : UNSUPPORTED_DESCRIPTION_KEY,
                isDisabled: !isUsbAvailable,
            },
        ],
        [isBleAvailable, isUsbAvailable],
    )

    return { options }
}
