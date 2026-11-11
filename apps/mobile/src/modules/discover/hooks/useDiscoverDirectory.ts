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
import {
    useDiscoverProjectsQuery,
    type PeraProject,
} from '@perawallet/wallet-core-projects'
import { discoverPlatform } from '../utils/discoverPlatform'
import { verifiedDappUrls } from '../utils/toDiscoverDapp'
import { useDiscoverCaip2s } from './useDiscoverCaip2s'
import { useDiscoverChainIds } from './useDiscoverChainIds'

export type UseDiscoverDirectoryParams = { isEnabled?: boolean }

export type UseDiscoverDirectoryResult = {
    projects: PeraProject[]
    verifiedUrls: ReadonlySet<string>
    isLoading: boolean
    isError: boolean
}

// The every-discover-chain list shared by search and the migration. Home keys
// per chip; this all-chains key is a documented deviation from the spec's
// "one query shared with Home".
export const useDiscoverDirectory = ({
    isEnabled = true,
}: UseDiscoverDirectoryParams = {}): UseDiscoverDirectoryResult => {
    const caip2s = useDiscoverCaip2s(useDiscoverChainIds())
    const query = useDiscoverProjectsQuery({
        platform: discoverPlatform(),
        chains: caip2s,
        isEnabled: isEnabled && caip2s.length > 0,
    })
    const projects = useMemo(() => query.data ?? [], [query.data])
    const verifiedUrls = useMemo(() => verifiedDappUrls(projects), [projects])
    return {
        projects,
        verifiedUrls,
        isLoading: query.isLoading,
        isError: query.isError,
    }
}
