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

export const baseJS = `var css = '*{-webkit-touch-callout:none;-webkit-user-select:none}textarea,input{user-select:text;-webkit-user-select:text;}';
var head = document.head || document.getElementsByTagName('head')[0];
var style = document.createElement('style'); style.type = 'text/css';
style.appendChild(document.createTextNode(css)); head.appendChild(style);`

export const peraMobileInterfaceJS = `
console.log('peraMobileInterfaceJS setup');
window.peraRPC = {
    sendJsonRPCMessage: (request) => {
        window.ReactNativeWebView?.postMessage(request); 
    },
    sendRNMessage: (action, params = {}) => {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
            jsonrpc: '2.0',
            method: action,
            params,
            id: Date.now()
        }));
    },
};
window.peraMobileInterface = {
    version: '2',
    handleRequest: (request) => window.peraRPC.sendJsonRPCMessage(request),
    pushWebView: (params) => window.peraRPC.sendRNMessage('pushWebView', params),
    openSystemBrowser: (params) => window.peraRPC.sendRNMessage('openSystemBrowser', params),
    canOpenURI: (params) => window.peraRPC.sendRNMessage('canOpenURI', params),
    openNativeURI: (params) => window.peraRPC.sendRNMessage('openNativeURI', params),
    notifyUser: (params) => window.peraRPC.sendRNMessage('notifyUser', params),
    getAddresses: () => window.peraRPC.sendRNMessage('getAddresses'),
    getSettings: () => window.peraRPC.sendRNMessage('getSettings'),
    getPublicSettings: () => window.peraRPC.sendRNMessage('getPublicSettings'),
    onBackPressed: () => window.peraRPC.sendRNMessage('onBackPressed'),
    logAnalyticsEvent: (params) => window.peraRPC.sendRNMessage('logAnalyticsEvent', params),
    closeWebView: () => window.peraRPC.sendRNMessage('closeWebView'),
    pushDappViewerScreen: (params) => window.peraRPC.sendRNMessage('pushWebView', JSON.parse(params)),

    // V1 function for backwards compatibility
    getAuthorizedAddresses: () => window.peraRPC.sendRNMessage('getAddresses'),
};
`

export const peraConnectJS = `
    function setupPeraConnectObserver(){
        const e = new MutationObserver(() => {
            const t = document.getElementById("pera-wallet-connect-modal-wrapper"),
                  e = document.getElementById("pera-wallet-redirect-modal-wrapper");
            if(e && e.remove(), t){
                const o = t.getElementsByTagName("pera-wallet-connect-modal");
                let e = "";
                if(o && o[0] && o[0].shadowRoot){
                    const a = o[0].shadowRoot
                        .querySelector("pera-wallet-modal-touch-screen-mode")
                        .shadowRoot
                        .querySelector("#pera-wallet-connect-modal-touch-screen-mode-launch-pera-wallet-button");
                    a && (e = a.getAttribute("href"));
                } else {
                    const r = t.getElementsByClassName("pera-wallet-connect-modal-touch-screen-mode__launch-pera-wallet-button");
                    r && (e = r[0].getAttribute("href"));
                }
                e && window.peraRPC?.sendRNMessage('walletConnect', { uri: e });
                t.remove();
            }
        });
        e.disconnect();
        e.observe(document.body, { childList: true, subtree: true });
    }
    setupPeraConnectObserver();
`

export const navigationJS = `
!function(t){function e(t){setTimeout((function(){window.ReactNativeWebView.postMessage(t)}),0)}\
function n(n){return function(){return e("other"),n.apply(t,arguments)}}t.pushState=n(t.pushState),t.replaceState=\
n(t.replaceState),window.addEventListener("popstate",(function(){e("backforward")}))}(window.history);
`

type FontFace = {
    family: string
    weight: number
    iosSrc: string
    androidFile: string
}

const fontFaces: FontFace[] = [
    {
        family: 'DM Sans',
        weight: 400,
        iosSrc: "local('DMSans-Regular'), local('DM Sans Regular')",
        androidFile: 'DMSansRegular.ttf',
    },
    {
        family: 'DM Sans',
        weight: 500,
        iosSrc: "local('DMSans-Medium'), local('DM Sans Medium')",
        androidFile: 'DMSansMedium.ttf',
    },
    {
        family: 'DM Sans',
        weight: 600,
        iosSrc: "local('DMSans-SemiBold'), local('DM Sans SemiBold')",
        androidFile: 'DMSansSemiBold.ttf',
    },
    {
        family: 'DM Sans',
        weight: 700,
        iosSrc: "local('DMSans-Bold'), local('DM Sans Bold')",
        androidFile: 'DMSansBold.ttf',
    },
    {
        family: 'DM Mono',
        weight: 400,
        iosSrc: "local('DMMono-Regular'), local('DM Mono Regular')",
        androidFile: 'DMMonoRegular.ttf',
    },
    {
        family: 'DM Mono',
        weight: 500,
        iosSrc: "local('DMMono-Medium'), local('DM Mono Medium')",
        androidFile: 'DMMonoMedium.ttf',
    },
]

const buildFontFaceCSS = (platform: 'ios' | 'android'): string => {
    const faces = fontFaces.map(f => {
        const src =
            platform === 'ios'
                ? f.iosSrc
                : `url('file:///android_asset/fonts/${f.androidFile}') format('truetype')`
        return `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;font-display:swap;src:${src};}`
    })

    const overrides = [
        "body{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif!important;}",
        "code,pre,kbd,samp{font-family:'DM Mono','DM Sans',monospace!important;}",
    ]

    return [...faces, ...overrides].join('')
}

export const getFontInjectionJS = (platform: 'ios' | 'android'): string => {
    const css = buildFontFaceCSS(platform)
    return `var head=document.head||document.getElementsByTagName('head')[0];if(!head){head=document.createElement('head');document.documentElement.prepend(head);}var fontStyle=document.createElement('style');fontStyle.type='text/css';fontStyle.appendChild(document.createTextNode("${css}"));head.appendChild(fontStyle);`
}
