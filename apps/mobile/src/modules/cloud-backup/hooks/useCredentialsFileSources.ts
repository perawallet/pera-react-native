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
    RemoteConfigKeys,
    useRemoteConfig,
} from '@perawallet/wallet-core-remote-config'

import type { CredentialsFileSource } from '../storage'
import {
    getCredentialsFileReadSources,
    getCredentialsFileSaveSources,
} from '../storage/credentialsFileSources'

const CLOUD_SOURCES: CredentialsFileSource[] = ['icloud', 'googleDrive']

const useVisibleSources = (
    sources: CredentialsFileSource[],
): CredentialsFileSource[] => {
    const remoteConfig = useRemoteConfig()
    const isCloudStorageEnabled = remoteConfig.getBooleanValue(
        RemoteConfigKeys.enable_backup_credentials_cloud_storage,
        false,
    )

    return useMemo(
        () =>
            isCloudStorageEnabled
                ? sources
                : sources.filter(source => !CLOUD_SOURCES.includes(source)),
        [isCloudStorageEnabled, sources],
    )
}

export const useCredentialsFileSaveSources = (): CredentialsFileSource[] =>
    useVisibleSources(getCredentialsFileSaveSources())

export const useCredentialsFileReadSources = (): CredentialsFileSource[] =>
    useVisibleSources(getCredentialsFileReadSources())
