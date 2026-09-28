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

/** The personal cloud drives a saved file can live in. */
export type CloudFileStore = 'icloud' | 'googleDrive'

/**
 * `cancelled` means nothing was written: the user backed out of the picker,
 * the sign-in or the scope grant.
 */
export type CloudFileSaveResult = 'saved' | 'cancelled'

export type CloudFileReadResult =
    | { status: 'read'; contents: string }
    | { status: 'cancelled' }

/**
 * Asks the user which file to read when the folder holds more than one
 * candidate. Returning `null` backs out of the read.
 */
export type ChooseCloudFile = (fileNames: string[]) => Promise<string | null>

export type ReadCloudFileOptions = {
    /**
     * Which names in the folder are ours to offer. Injected so the store stays
     * free of any one caller's naming rules.
     */
    isCandidate: (fileName: string) => boolean
    chooseFile: ChooseCloudFile
    /**
     * Fires once nothing but the read itself is left, so a progress overlay
     * can't collide with a picker or a sign-in sheet.
     */
    onReading?: () => void
    /**
     * Honoured by iCloud only, where it ends the wait for a placeholder still
     * downloading and resolves the read as `cancelled`; a request already in
     * flight still has to come back before that is noticed. Drive runs to
     * completion regardless.
     */
    signal?: AbortSignal
}

/**
 * An app-private folder in the user's own cloud drive (Drive's appDataFolder,
 * iCloud's ubiquity container), used to keep a file the user can restore from
 * after losing the device.
 */
export interface CloudFileStorageService {
    /** Stores this build and OS can actually reach, in display order. */
    getAvailableStores(): CloudFileStore[]
    save(
        store: CloudFileStore,
        fileName: string,
        contents: string,
    ): Promise<CloudFileSaveResult>
    /**
     * Resolves which file to read and reads it in a single session, so the
     * user signs in once.
     */
    read(
        store: CloudFileStore,
        options: ReadCloudFileOptions,
    ): Promise<CloudFileReadResult>
}
