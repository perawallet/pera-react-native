export const baseJS = `var css = '*{-webkit-touch-callout:none;-webkit-user-select:none}textarea,input{user-select:text;-webkit-user-select:text;}';
var head = document.head || document.getElementsByTagName('head')[0];
var style = document.createElement('style'); style.type = 'text/css';
style.appendChild(document.createTextNode(css)); head.appendChild(style);`;

export const peraMobileInterfaceJS = `
if (window.ReactNativeWebView) {
    function sendRNMessage(action, params) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ action, params })); 
    };
    const peraMobileInterface = {
        version: '2',
        openSystemBrowser: (params) => sendRNMessage('openSystemBrowser', params),
        closeWebView: () => sendRNMessage('closeWebView'),
        openDappWebview: (params) => sendRNMessage('openDappWebview', params),
        pushDappViewerScreen: (params) => sendRNMessage('pushDappViewerScreen', params),
        getAuthorizedAddresses: () => sendRNMessage('getAuthorizedAddresses', params),
        getDeviceId: () => sendRNMessage('getDeviceId'),
        closePeraCards: () => sendRNMessage('closePeraCards'),
        handleTokenDetailActionButtonClick: (params) => sendRNMessage('handleTokenDetailActionButtonClick', params),
        pushNewScreen: (params) => sendRNMessage('pushNewScreen', params),
        pushTokenDetailScreen: (params) => sendRNMessage('pushTokenDetailScreen', params)
    };
    window.peraMobileInterface = peraMobileInterface;
} 
else { 
    alert('Failed to connect to Pera Wallet'); 
}`
  .replaceAll('\n', '')
  .replaceAll(' ', '');

export const peraConnectJS = `function setupPeraConnectObserver(){const e=new MutationObserver(()=>{const \
t=document.getElementById("pera-wallet-connect-modal-wrapper"),e=document.getElementById("pera-wallet-redirect-modal-wrapper");\
if(e&&e.remove(),t){const o=t.getElementsByTagName("pera-wallet-connect-modal");\
let e="";if(o&&o[0]&&o[0].shadowRoot){const a=o[0].shadowRoot.querySelector("pera-wallet-modal-touch-screen-mode")\
.shadowRoot.querySelector("#pera-wallet-connect-modal-touch-screen-mode-launch-pera-wallet-button")\
;alert("LINK_ELEMENT_V1"+a),a&&(e=a.getAttribute("href"))}else{const r=t.getElementsByClassName(\
"pera-wallet-connect-modal-touch-screen-mode__launch-pera-wallet-button");alert("LINK_ELEMENT_V0"+r)\
,r&&(e=r[0].getAttribute("href"))}alert("WC_URI "+e),e&&(window.ReactNativeWebview.postMessage(e),\
alert("Message sent to App"+e)),t.remove()}});e.disconnect(),e.observe(document.body,{childList:!0,subtree:!0})}\
setupPeraConnectObserver();
`;

export const navigationJS = `
!function(t){function e(t){setTimeout((function(){window.webkit.messageHandlers.navigation.postMessage(t)}),0)}\
function n(n){return function(){return e("other"),n.apply(t,arguments)}}t.pushState=n(t.pushState),t.replaceState=\
n(t.replaceState),window.addEventListener("popstate",(function(){e("backforward")}))}(window.history);
`;
