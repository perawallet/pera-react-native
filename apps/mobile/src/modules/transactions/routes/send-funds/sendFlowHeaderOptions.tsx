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

import type { ReactElement } from 'react'
import type { Optional } from '@perawallet/wallet-core-shared'
import { SendFlowCloseButton } from '../../components/send-funds/SendFlowCloseButton'
import type { SendFundsStackParamList } from './types'

type SendFlowHeaderOptions = {
    headerShown: true
    headerLeft: Optional<() => null>
    headerRight: () => ReactElement
}

// `canGoBack()` answers for the whole stack, so the first screen needs an
// explicit null to keep a dead chevron off its header once a later screen is
// on top.
export const sendFlowHeaderOptions = (
    routeName: keyof SendFundsStackParamList,
    initialRouteName: keyof SendFundsStackParamList,
): SendFlowHeaderOptions => ({
    headerShown: true,
    headerLeft: routeName === initialRouteName ? () => null : undefined,
    headerRight: () => <SendFlowCloseButton />,
})
