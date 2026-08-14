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

export interface CrashReportingService {
    initializeCrashReporting(): void
    /**
     * `groupingKey` names the logical error site, for reporters that fingerprint
     * on something other than the error's own stack. Optional: a caller with a
     * genuine stack should omit it and let the stack do the grouping.
     */
    recordNonFatalError(error: unknown, groupingKey?: string): void
}
