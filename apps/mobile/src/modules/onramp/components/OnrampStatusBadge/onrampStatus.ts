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

import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { OnrampStatus } from '@perawallet/wallet-core-onramp'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { IconName, PWIconVariant } from '@components/core'

export type OnrampStatusColor =
    | 'positive'
    | 'warning'
    | 'negative'
    | 'neutral'
    | 'main'

export type OnrampStatusDescriptor = {
    /** PWIcon name for the inline status indicator; null = no icon (cancelled). */
    icon: Nullable<IconName>
    /** Semantic color used for the pill (OnrampStatusBadge) styling. */
    color: OnrampStatusColor
    /** PWIcon variant resolving the inline status color. */
    iconVariant: PWIconVariant
    /** i18n key for the status word. */
    labelKey: I18nKey
}

export const ONRAMP_STATUS_DESCRIPTORS: Record<
    OnrampStatus,
    OnrampStatusDescriptor
> = {
    pending: {
        icon: 'pending',
        color: 'warning',
        iconVariant: 'warning',
        labelKey: i18nKey('onramp.status.pending'),
    },
    in_progress: {
        icon: 'progress',
        color: 'main',
        iconVariant: 'primary',
        labelKey: i18nKey('onramp.status.in_progress'),
    },
    completed: {
        icon: 'check',
        color: 'positive',
        iconVariant: 'positive',
        labelKey: i18nKey('onramp.status.completed'),
    },
    failed: {
        icon: 'error-circle',
        color: 'negative',
        iconVariant: 'error',
        labelKey: i18nKey('onramp.status.failed'),
    },
    cancelled: {
        icon: null,
        color: 'neutral',
        iconVariant: 'secondary',
        labelKey: i18nKey('onramp.status.cancelled'),
    },
}

export const getOnrampStatusDescriptor = (
    status: OnrampStatus,
): OnrampStatusDescriptor => ONRAMP_STATUS_DESCRIPTORS[status]
