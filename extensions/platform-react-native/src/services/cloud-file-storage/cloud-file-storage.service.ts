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
import type {
    CloudFileReadResult,
    CloudFileSaveResult,
    CloudFileStorageService,
    CloudFileStore,
    ReadCloudFileOptions,
} from '@perawallet/wallet-extension-platform'

import {
    isGoogleDriveConfigured,
    readFromGoogleDrive,
    saveToGoogleDrive,
} from './google-drive'
import { readFromICloud, saveToICloud } from './icloud'

// iCloud has no Android client. Anything that is neither mobile OS ships
// neither native SDK, so it must never be offered a row that would throw the
// moment it is tapped.
const STORES_BY_OS: Partial<Record<typeof Platform.OS, CloudFileStore[]>> = {
    ios: ['icloud', 'googleDrive'],
    android: ['googleDrive'],
}
const NONE: CloudFileStore[] = []

// Drive's OAuth client ids come from build-time config: without them the row
// can only throw, and that throw is a crash report rather than a banner.
// iCloud's own check is async, so it degrades to a typed error at read time.
const isConfiguredInBuild = (store: CloudFileStore): boolean =>
    store !== 'googleDrive' || isGoogleDriveConfigured()

export class RNCloudFileStorageService implements CloudFileStorageService {
    getAvailableStores(): CloudFileStore[] {
        return (STORES_BY_OS[Platform.OS] ?? NONE).filter(isConfiguredInBuild)
    }

    save(
        store: CloudFileStore,
        fileName: string,
        contents: string,
    ): Promise<CloudFileSaveResult> {
        return store === 'icloud'
            ? saveToICloud(fileName, contents)
            : saveToGoogleDrive(fileName, contents)
    }

    read(
        store: CloudFileStore,
        options: ReadCloudFileOptions,
    ): Promise<CloudFileReadResult> {
        return store === 'icloud'
            ? readFromICloud(options)
            : readFromGoogleDrive(options)
    }
}
