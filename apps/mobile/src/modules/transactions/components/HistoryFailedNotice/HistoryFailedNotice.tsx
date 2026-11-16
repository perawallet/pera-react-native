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

import type { StyleProp, ViewStyle } from 'react-native'
import { ChainNotice } from '@components/ChainNotice'
import {
    useHistoryFailedNotice,
    type UseHistoryFailedNoticeParams,
} from './useHistoryFailedNotice'

export type HistoryFailedNoticeProps = UseHistoryFailedNoticeParams & {
    style?: StyleProp<ViewStyle>
    testID?: string
}

/** Names the networks whose history couldn't be read while rows still show. */
export const HistoryFailedNotice = ({
    style,
    testID,
    ...params
}: HistoryFailedNoticeProps) => {
    const {
        isVisible,
        params: copyParams,
        action,
    } = useHistoryFailedNotice(params)

    if (!isVisible) return null

    return (
        <ChainNotice
            kind='error'
            titleKey='asset_details.transaction_list.network_failed'
            params={copyParams}
            action={action}
            style={style}
            testID={testID}
        />
    )
}
