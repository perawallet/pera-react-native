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

/**
 * Best-effort favicon URL for a Liquid Auth dApp origin/host. Liquid Auth
 * carries no icon over the wire, so we fall back to the conventional
 * `<origin>/favicon.ico`. Returns undefined when there is no origin.
 */
export const faviconUrlForOrigin = (
    origin: string | undefined,
): string | undefined =>
    origin ? `${origin.replace(/\/+$/, '')}/favicon.ico` : undefined
