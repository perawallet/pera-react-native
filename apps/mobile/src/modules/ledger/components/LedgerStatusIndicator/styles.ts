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

import { makeStyles, Colors } from '@rneui/themed'
import type { LedgerConnectionStatus } from '@perawallet/wallet-core-ledger'

type StyleProps = {
    status: LedgerConnectionStatus
}

const getStatusColor = (
    status: LedgerConnectionStatus,
    colors: Colors,
): string => {
    switch (status) {
        case 'ready':
        case 'connected':
            return colors.positive
        case 'scanning':
        case 'connecting':
            return colors.warning
        case 'app_not_open':
            return colors.negative
        case 'disconnected':
        default:
            return colors.textGray
    }
}

export const useStyles = makeStyles((theme, { status }: StyleProps) => {
    const statusColor = getStatusColor(status, theme.colors)

    return {
        container: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: statusColor,
            marginRight: theme.spacing.xs,
        },
        text: {
            color: statusColor,
        },
    }
})
