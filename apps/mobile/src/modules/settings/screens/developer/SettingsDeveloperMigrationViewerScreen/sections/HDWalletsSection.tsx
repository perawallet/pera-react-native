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

import type { LegacyHDWallet } from '@perawallet/wallet-extension-platform'
import { MigrationDataSection } from '../components/MigrationDataSection'
import { EmptyDataHint } from '../components/EmptyDataHint'
import { MigrationDataRow } from '../components/MigrationDataRow'
import { MigrationDataSubBlock } from '../components/MigrationDataSubBlock'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

export const HDWalletsSection = ({
    hdWallets,
}: {
    hdWallets: LegacyHDWallet[]
}) => {
    return (
        <MigrationDataSection
            title='HD Wallets'
            count={hdWallets.length}
        >
            {hdWallets.length === 0 ? (
                <EmptyDataHint />
            ) : (
                hdWallets.map((w, i) => (
                    <MigrationDataSubBlock
                        key={`${w.walletId}-${i}`}
                        title={`#${i} — ${w.walletId}`}
                    >
                        <MigrationDataRow
                            label='walletId'
                            value={w.walletId}
                        />
                        <MigrationDataRow
                            label='name'
                            value={w.name}
                        />
                        <MigrationDataRow
                            label='entropy'
                            value={w.entropy}
                        />
                        <MigrationDataSubBlock
                            title={`keys (${w.keys.length})`}
                        >
                            {w.keys.length === 0 ? (
                                <EmptyDataHint />
                            ) : (
                                w.keys.map((k, j) => (
                                    <MigrationDataSubBlock
                                        key={`${k.address}-${j}`}
                                        title={`#${j} — ${truncateAlgorandAddress(k.address)}`}
                                    >
                                        <MigrationDataRow
                                            label='address'
                                            value={k.address}
                                        />
                                        <MigrationDataRow
                                            label='account'
                                            value={k.account}
                                        />
                                        <MigrationDataRow
                                            label='change'
                                            value={k.change}
                                        />
                                        <MigrationDataRow
                                            label='keyIndex'
                                            value={k.keyIndex}
                                        />
                                        <MigrationDataRow
                                            label='derivationType'
                                            value={k.derivationType}
                                        />
                                    </MigrationDataSubBlock>
                                ))
                            )}
                        </MigrationDataSubBlock>
                    </MigrationDataSubBlock>
                ))
            )}
        </MigrationDataSection>
    )
}
