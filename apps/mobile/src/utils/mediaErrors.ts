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

/** Thrown by `saveImageToDevice` (native) when the user denies the gallery
 * write permission, so callers can show permission-specific copy instead of
 * a generic failure toast. The web twin never throws this — a browser
 * download has no comparable permission step. */
export class MediaPermissionDeniedError extends Error {
    constructor() {
        super('Media library permission denied')
        this.name = 'MediaPermissionDeniedError'
    }
}
