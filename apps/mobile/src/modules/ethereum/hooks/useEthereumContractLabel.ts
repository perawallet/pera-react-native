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
import type {
    ChainScope,
    KnownSpender,
} from '@perawallet/wallet-core-chain-contract'
import { useEvmContractMetadataQuery } from '@perawallet/wallet-core-chain-ethereum'
import { toSiteHost } from '@perawallet/wallet-core-site-safety'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

/** A contract named for the user: its name, and its project's domain for matching the requesting site. */
export type EthereumContractLabel = KnownSpender

const domainOf = (url: string): Optional<string> =>
    toSiteHost(url)?.ascii.replace(/^www\./, '')

/**
 * Names a contract the same way on every step of a dApp flow: Pera's curated
 * metadata when the backend vouches for it, else the bundled registry's entry.
 * The bundled entry shows meanwhile, so a label never blinks in late.
 */
export const useEthereumContractLabel = (
    scope: ChainScope,
    address: Optional<string>,
    bundled: Optional<EthereumContractLabel>,
    isEnabled = true,
): Nullable<EthereumContractLabel> => {
    const { data: metadata } = useEvmContractMetadataQuery({
        scope,
        address,
        isEnabled,
    })

    return useMemo(() => {
        if (!isEnabled) return null
        if (!metadata) return bundled ?? null
        const projectDomain = domainOf(metadata.projectUrl)
        return { name: metadata.name, ...(projectDomain && { projectDomain }) }
    }, [isEnabled, metadata, bundled])
}
