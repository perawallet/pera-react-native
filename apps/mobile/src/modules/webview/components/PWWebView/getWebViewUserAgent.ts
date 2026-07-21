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

import type { DeviceInfoService } from '@perawallet/wallet-extension-platform'

/**
 * UA suffix appended to the WebView's default browser UA. Trusted origins
 * (the Discover web app) get the full device UA they rely on; untrusted
 * origins get only `pera_<platform>_<version>` — no device model or OS
 * version granularity, matching what the native apps append everywhere. The
 * `pera` token is kept because @perawallet/connect sniffs it to select the
 * in-app-browser connect flow.
 */
export const getWebViewUserAgent = (
    deviceInfo: DeviceInfoService,
    isTrustedOrigin: boolean,
): string =>
    isTrustedOrigin
        ? deviceInfo.getUserAgent()
        : `pera_${deviceInfo.getDevicePlatform()}_${deviceInfo.getAppVersion()}`
