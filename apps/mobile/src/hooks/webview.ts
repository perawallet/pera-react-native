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

import WebView from 'react-native-webview';
import useToast from './toast';
import { Linking } from 'react-native';
import {
  getAccountDisplayName,
  useAllAccounts,
  useCurrency,
  useDeviceID,
  useDeviceInfoService,
  useNetwork,
  useSettings,
} from '@perawallet/core';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type PushNewScreenParams = {
  url: string;
};

type PushInternalBrowserParams = {
  url: string;
  name?: string;
  projectId?: string;
  isFavorite?: boolean;
};

type OpenSystemBrowserParams = {
  url: string;
};

type NotifyUserParams = {
  type: 'haptic' | 'sound' | 'message';
  variant: string;
  message?: string;
};

type LogAnalyticsParams = {
  name: string;
  payload: unknown;
};

type WebviewMessage = {
  action: string;
  params: Record<string, any>;
};

export const usePeraWebviewInterface = (webview: WebView | null) => {
  const { showToast } = useToast();
  const accounts = useAllAccounts();
  const deviceID = useDeviceID();
  const { theme } = useSettings();
  const { network } = useNetwork();
  const deviceInfo = useDeviceInfoService();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const { preferredCurrency } = useCurrency()

  const pushNewScreen = (_: PushNewScreenParams) => {
    //TODO navigate to deeplink
  };
  const pushInternalBrowser = (_: PushInternalBrowserParams) => {
    //TODO add a new webview
  };
  const openSystemBrowser = (params: OpenSystemBrowserParams) => {
    Linking.canOpenURL(params.url).then(supported => {
      if (supported) {
        Linking.openURL(params.url);
      } else {
        showToast({
          title: "Can't open webpage",
          body: "The page you're viewing has sent an invalid message format.",
          type: 'error',
        });
      }
    });
  };

  const notifyUser = (params: NotifyUserParams) => {
    if (params.type === 'message') {
      showToast({
        title: '',
        body: params.message ?? '',
        type: 'info',
      });
    }
    //TODO add sound and haptic (and maybe message.banner) support
  };

  const getAddresses = () => {
    const payload = accounts.map(a => ({
      name: getAccountDisplayName(a),
      address: a.address,
      type: 'HdKey', //TODO support other types also
    }));
    webview?.postMessage(JSON.stringify(payload));
  };

  const getSettings = () => {
    const payload = {
      //TODO make some more of this configurable and/or add to deviceInfo
      appName: 'Pera Wallet',
      appPackageName: 'pera-rn',
      appVersion: deviceInfo.getAppVersion(),
      clientType: deviceInfo.getDevicePlatform(),
      deviceId: deviceID,
      deviceVersion: deviceInfo.getDeviceModel(),
      deviceOSVersion: deviceInfo.getDevicePlatform(),
      deviceModel: deviceInfo.getDeviceModel(),
      theme,
      network,
      currency: preferredCurrency,
      region: 'en-US', //TODO pull from state eventually (or device location or something)
      language: 'en-US', //TODO pull from app locale
    };
    webview?.postMessage(JSON.stringify(payload));
  };
  const getPublicSettings = () => {
    const payload = {
      theme,
      network,
      currency: preferredCurrency,
      language: 'en-US', //TODO pull from app locale
    };
    webview?.postMessage(JSON.stringify(payload));
  };
  const onBackPressed = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };
  const logAnalyticsEvent = (_: LogAnalyticsParams) => {
    //TODO implement when we have analytics hooked up
  };
  const closeWebView = () => {
    //TODO implement once we figure out how based on how we implement the push functions above
  };

  const handleMessage = ({ action, params }: WebviewMessage) => {
    switch (action) {
      case 'pushNewScreen':
        pushNewScreen(params as PushNewScreenParams);
        break;
      case 'pushInternalBrowser':
        pushInternalBrowser(params as PushInternalBrowserParams);
        break;
      case 'openSystemBrowser':
        openSystemBrowser(params as OpenSystemBrowserParams);
        break;
      case 'notifyUser':
        notifyUser(params as NotifyUserParams);
        break;
      case 'getAddresses':
        getAddresses();
        break;
      case 'getSettings':
        getSettings();
        break;
      case 'getPublicSettings':
        getPublicSettings();
        break;
      case 'onBackPressed':
        onBackPressed();
        break;
      case 'logAnalyticsEvent':
        logAnalyticsEvent(params as LogAnalyticsParams);
        break;
      case 'closeWebView':
        closeWebView();
        break;
      default:
        showToast({
          title: 'Invalid message received.',
          body: "The page you're viewing has sent an invalid message format.",
          type: 'error',
        });
        break;
    }
  };

  return {
    handleMessage,
  };
};
