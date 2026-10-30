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

import { Decimal } from 'decimal.js'
import {
    i18nKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { TransactionWarning } from '@perawallet/wallet-core-signing'
import {
    formatAssetAmount,
    useNativeAsset,
} from '@perawallet/wallet-core-assets'
import {
    LONG_ADDRESS_LENGTH,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import type { WarningRowProps } from './WarningRow'

export type UseWarningItemParams = {
    warning: TransactionWarning
    isGroup: boolean
    scope: ChainScope
}

export type UseWarningItemResult = Pick<
    WarningRowProps,
    'icon' | 'message' | 'emphasis' | 'caption'
>

type AddressWarning = Extract<
    TransactionWarning,
    { type: 'close-account' | 'close-asset' | 'delegation' | 'asset-freeze' }
>

const getWarningConfig = (type: AddressWarning['type'], isGroup: boolean) => {
    switch (type) {
        case 'close-account': {
            return {
                icon: 'trash' as const,
                messageKey: isGroup
                    ? i18nKey(
                          'transactions.warning.close_account_group_warning',
                      )
                    : i18nKey('transactions.warning.close_account_warning'),
                boldKey: null,
            }
        }
        case 'close-asset': {
            return {
                icon: 'unlink' as const,
                messageKey: isGroup
                    ? i18nKey('transactions.warning.close_asset_group_warning')
                    : i18nKey('transactions.warning.close_asset_warning'),
                boldKey: null,
            }
        }
        case 'delegation': {
            return {
                icon: 'rekey' as const,
                messageKey: isGroup
                    ? i18nKey('transactions.warning.rekey_group_warning')
                    : i18nKey('transactions.warning.rekey_warning'),
                boldKey: i18nKey('transactions.warning.rekey_warning_bold'),
            }
        }
        case 'asset-freeze': {
            return {
                icon: 'snowflake' as const,
                messageKey: isGroup
                    ? i18nKey('transactions.warning.asset_freeze_group_warning')
                    : i18nKey('transactions.warning.asset_freeze_warning'),
                boldKey: i18nKey(
                    'transactions.warning.asset_freeze_warning_bold',
                ),
            }
        }
    }
}

export const useWarningItem = ({
    warning,
    isGroup,
    scope,
}: UseWarningItemParams): UseWarningItemResult => {
    const nativeAsset = useNativeAsset(scope)
    const { t } = useLanguage()

    if (warning.type === 'high-fee') {
        return {
            icon: 'info',
            message: t('transactions.warning.high_fee_warning', {
                fee: formatAssetAmount(
                    new Decimal(warning.totalFee.toString()),
                    nativeAsset,
                ),
            }),
        }
    }

    const { icon, messageKey, boldKey } = getWarningConfig(
        warning.type,
        isGroup,
    )

    return {
        icon,
        message: t(messageKey, {
            address: truncateAlgorandAddress(
                warning.targetAddress,
                LONG_ADDRESS_LENGTH,
            ),
        }),
        emphasis: boldKey ? t(boldKey) : undefined,
        caption: t('transactions.warning.from_account', {
            address: truncateAlgorandAddress(
                warning.senderAddress,
                LONG_ADDRESS_LENGTH,
            ),
        }),
    }
}
