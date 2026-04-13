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

/** Maximum addresses per bulk-read request. Conservative — tune if backend allows more. */
export const NFD_BULK_CHUNK_SIZE = 50

/** How long a cached row (positive or negative) is considered fresh. */
export const NFD_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h
