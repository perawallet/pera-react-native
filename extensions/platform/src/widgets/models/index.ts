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

import type { Nullable } from '@perawallet/wallet-core-shared'

export type WidgetImageRequest = {
    /** Stable cache key, also the file-name stem in shared storage. Digits only. */
    key: string
    /** Only https URLs are fetched. */
    url: string
}

/** The pin set the app enforces for a backend host, for the widgets' own requests to it. */
export type WidgetBackendPinning = {
    /** Base64 SHA-256 SPKI hashes; any one matching a certificate in the chain passes. */
    publicKeyHashes: string[]
    /** ISO 8601 UTC; past it the pins are ignored rather than enforced. */
    expiresAt: string
}

export interface WidgetsService {
    /** Stores the serialized snapshot and asks the OS to reload widget timelines. */
    writeSnapshot(json: string): Promise<void>
    /** Removes the snapshot and every cached widget image. */
    clearSnapshot(): Promise<void>
    /**
     * Downloads and downsamples images for keys not already cached, deletes
     * cached keys absent from `items`, and resolves with the keys now on disk.
     */
    syncImages(items: WidgetImageRequest[]): Promise<string[]>
    /** True once per scan the Control Center control requested; clears the request. */
    consumePendingScan(): Promise<boolean>
    /**
     * Calls `listener` when the Scan control fires while the app is running, so
     * a request recorded after activation isn't missed. Returns an unsubscribe.
     */
    onScanRequested(listener: () => void): () => void
    /**
     * The pins the widgets should apply to `backendUrl`: null unless the app
     * pins that host itself (the Pera API pinning flag is on and the host is
     * pinnable).
     */
    backendPinning(backendUrl: string): Nullable<WidgetBackendPinning>
}
