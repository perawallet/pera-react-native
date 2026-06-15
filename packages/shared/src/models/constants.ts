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

export const DEFAULT_PAGE_SIZE = 50
export const DEFAULT_PRECISION = 2
export const DEFAULT_PRISM_IMAGE_QUALITY = 70

/**
 * Per-attempt request timeout (ms) for chart/history endpoints. These hit slow
 * aggregation queries on the backend and routinely exceed ky's 10s default.
 */
export const CHART_QUERY_TIMEOUT_MS = 30_000
