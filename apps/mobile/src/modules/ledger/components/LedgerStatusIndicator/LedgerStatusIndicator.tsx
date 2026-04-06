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

import React from 'react'
import { PWView, PWText } from '@components/core'
import type { LedgerConnectionStatus } from '@perawallet/wallet-core-ledger'
import { useLanguage } from '@hooks/useLanguage'

import { useStyles } from './styles'

type LedgerStatusIndicatorProps = {
    status: LedgerConnectionStatus
}

const getStatusKey = (status: LedgerConnectionStatus): string => {
    switch (status) {
        case 'disconnected':
            return 'ledger.status.disconnected'
        case 'scanning':
            return 'ledger.status.scanning'
        case 'connecting':
            return 'ledger.status.connecting'
        case 'connected':
            return 'ledger.status.connected'
        case 'app_not_open':
            return 'ledger.status.app_not_open'
        case 'ready':
            return 'ledger.status.ready'
        default:
            return 'ledger.status.disconnected'
    }
}

export const LedgerStatusIndicator = ({
    status,
}: LedgerStatusIndicatorProps) => {
    const styles = useStyles({ status })
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <PWView style={styles.dot} />
            <PWText
                variant='caption'
                style={styles.text}
            >
                {t(getStatusKey(status))}
            </PWText>
        </PWView>
    )
}
