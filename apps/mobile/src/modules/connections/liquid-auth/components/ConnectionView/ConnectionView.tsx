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

import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { ConnectionApprovalSheet } from '@modules/connections/components/ConnectionApprovalSheet'
import { useLanguage } from '@hooks/useLanguage'
import { LIQUID_AUTH_PERMISSIONS } from '../../constants'

export type ConnectionViewProps = {
    /** Signaling host the dApp connects through — the only identity we have. */
    host: string
    onApprove: (address: string) => void
    onReject: () => void
}

/**
 * Pre-ceremony approval. Liquid Auth binds exactly one account into the FIDO
 * credential, so this is a single-account choice (defaulting to the active
 * account). Liquid Auth carries no dApp metadata, so the host's own favicon
 * stands in as the icon (same origin the user is already connecting to) and
 * the host stands in as the title.
 */
export const ConnectionView = ({
    host,
    onApprove,
    onReject,
}: ConnectionViewProps) => {
    const { t } = useLanguage()
    const { network } = useNetwork()

    return (
        <ConnectionApprovalSheet
            networks={[network === 'testnet' ? 'testnet' : 'mainnet']}
            iconUri={`${host.replace(/\/+$/, '')}/favicon.ico`}
            fallbackIconName='globe'
            title={t('liquidauth.request.title')}
            subtitle={t('liquidauth.request.host_label', { host })}
            permissions={LIQUID_AUTH_PERMISSIONS}
            accountsTitle={t('liquidauth.request.accounts_title')}
            mode='single'
            onApprove={addresses => addresses[0] && onApprove(addresses[0])}
            onReject={onReject}
        />
    )
}
