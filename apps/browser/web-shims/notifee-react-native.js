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

// Web shim for @notifee/react-native. The real package constructs its
// NotifeeApiModule class at module-eval time (`new NotifeeApiModule({
// nativeModuleName: 'NotifeeApiModule', ... })`), which reaches into the
// legacy React Native NativeModules bridge immediately on import and throws
// "__fbBatchedBridgeConfig is not set" in browser environments.
//
// Nothing on web reads these values any more: useSystemNotificationPermission
// has a `.web.ts` twin that reports the browser's own Notification.permission,
// because this stub's hardcoded DENIED would render the settings switch
// permanently off once push shipped on web. The stub survives only so the
// module-eval crash above stays impossible — do NOT treat DENIED as meaningful.

export const AuthorizationStatus = {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
}

const notifee = {
    getNotificationSettings: async () => ({
        authorizationStatus: AuthorizationStatus.DENIED,
    }),
}

export default notifee
