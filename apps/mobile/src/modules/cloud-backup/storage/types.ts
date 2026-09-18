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

/**
 * `cancelled` means nothing was saved: the user backed out, or a
 * picker failed silently.
 */
export type SaveResult = 'saved' | 'cancelled'

export type CredentialsFileSaver = (
    fileName: string,
    contents: string,
) => Promise<SaveResult>

export type CredentialsFileSource = 'device' | 'icloud' | 'googleDrive'

/**
 * `cancelled` means nothing was read: the user backed out, or a
 * picker failed silently.
 */
export type ReadResult =
    | { status: 'read'; contents: string }
    | { status: 'cancelled' }

/**
 * `onReading` fires once nothing but the read itself is left, so a
 * progress overlay can't collide with a picker or sign-in sheet.
 */
export type CredentialsFileReader = (
    fileName: string,
    onReading?: () => void,
) => Promise<ReadResult>

export type ListResult =
    | { status: 'listed'; fileNames: string[] }
    | { status: 'cancelled' }

export type CredentialsFileLister = (
    onListing?: () => void,
) => Promise<ListResult>

/**
 * Asks the user which saved key to read when a folder holds several. Returning
 * `null` backs out of the restore.
 */
export type ChooseCredentialsFile = (
    fileNames: string[],
) => Promise<string | null>
