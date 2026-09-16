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

import { Platform } from 'react-native'

import type { CredentialsFileSource } from './types'

// iCloud has no Android client, and the browser extension ships neither
// native SDK.
const SOURCES_BY_OS: Partial<
    Record<typeof Platform.OS, CredentialsFileSource[]>
> = {
    ios: ['device', 'icloud', 'googleDrive'],
    android: ['device', 'googleDrive'],
}
const EXTENSION_SAVE_SOURCES: CredentialsFileSource[] = ['device']
// The extension's toolbar popup closes as soon as an OS file dialog opens.
const EXTENSION_READ_SOURCES: CredentialsFileSource[] = []

export const getCredentialsFileSaveSources = (): CredentialsFileSource[] =>
    SOURCES_BY_OS[Platform.OS] ?? EXTENSION_SAVE_SOURCES

export const getCredentialsFileReadSources = (): CredentialsFileSource[] =>
    SOURCES_BY_OS[Platform.OS] ?? EXTENSION_READ_SOURCES
