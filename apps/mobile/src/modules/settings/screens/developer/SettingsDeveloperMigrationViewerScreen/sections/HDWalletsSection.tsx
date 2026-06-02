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

import { useLanguage } from '@hooks/useLanguage'
import type { LegacyHDWallet } from '@perawallet/wallet-extension-platform'
import {
    CollapsibleSection,
    EmptyHint,
    InlineRow,
    SubBlock,
    truncateAddress,
} from '../SettingsDeveloperMigrationViewerScreen'

export const HDWalletsSection = ({
    hdWallets,
}: {
    hdWallets: LegacyHDWallet[]
}) => {
    const { t } = useLanguage()
    return (
        <CollapsibleSection
            title={t('settings.developer.migration_viewer.section_hd_wallets')}
            count={hdWallets.length}
        >
            {hdWallets.length === 0 ? (
                <EmptyHint />
            ) : (
                hdWallets.map((w, i) => (
                    <SubBlock
                        key={`${w.walletId}-${i}`}
                        title={`#${i} — ${w.walletId}`}
                    >
                        <InlineRow
                            label='walletId'
                            value={w.walletId}
                        />
                        <InlineRow
                            label='name'
                            value={w.name}
                        />
                        <InlineRow
                            label='entropy'
                            value={w.entropy}
                        />
                        <SubBlock title={`keys (${w.keys.length})`}>
                            {w.keys.length === 0 ? (
                                <EmptyHint />
                            ) : (
                                w.keys.map((k, j) => (
                                    <SubBlock
                                        key={`${k.address}-${j}`}
                                        title={`#${j} — ${truncateAddress(k.address)}`}
                                    >
                                        <InlineRow
                                            label='address'
                                            value={k.address}
                                        />
                                        <InlineRow
                                            label='account'
                                            value={k.account}
                                        />
                                        <InlineRow
                                            label='change'
                                            value={k.change}
                                        />
                                        <InlineRow
                                            label='keyIndex'
                                            value={k.keyIndex}
                                        />
                                        <InlineRow
                                            label='derivationType'
                                            value={k.derivationType}
                                        />
                                    </SubBlock>
                                ))
                            )}
                        </SubBlock>
                    </SubBlock>
                ))
            )}
        </CollapsibleSection>
    )
}
