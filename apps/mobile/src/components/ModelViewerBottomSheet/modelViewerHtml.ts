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

type ModelViewerHtmlParams = {
    modelUrl: string
}

// Allow only printable ASCII characters that are valid in URLs (RFC 3986
// unreserved + reserved + percent-encoding). Anything outside this set —
// quotes, angle brackets, whitespace, control characters, or any
// non-ASCII / Unicode codepoint — is rejected to prevent breaking out of
// the src attribute or smuggling exotic characters into the WebView.
const SAFE_URL_CHARACTERS = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/

/**
 * Validates and normalizes a model URL before embedding it into the
 * WebView HTML. Throws when the input is not a well-formed https URL or
 * contains characters that could be used to break out of the src
 * attribute. Anything injected into the document body must pass through
 * this function.
 */
export const sanitizeModelUrl = (modelUrl: string): string => {
    if (typeof modelUrl !== 'string' || modelUrl.length === 0) {
        throw new Error('Model URL is empty')
    }
    if (modelUrl.length > 2048) {
        throw new Error('Model URL is too long')
    }
    if (!SAFE_URL_CHARACTERS.test(modelUrl)) {
        throw new Error('Model URL contains disallowed characters')
    }
    let parsed: URL
    try {
        parsed = new URL(modelUrl)
    } catch {
        throw new Error('Model URL is not a valid URL')
    }
    if (parsed.protocol !== 'https:') {
        throw new Error('Model URL must use https')
    }
    if (!parsed.hostname) {
        throw new Error('Model URL is missing a hostname')
    }
    // Re-serialize from the URL parser so any odd-but-legal input gets
    // canonicalized; this also strips userinfo etc. which our regex
    // happens to permit but we never want to forward.
    if (parsed.username || parsed.password) {
        throw new Error('Model URL must not include credentials')
    }
    return parsed.toString()
}

export const buildModelViewerHtml = ({
    modelUrl,
}: ModelViewerHtmlParams): string => {
    const safeUrl = sanitizeModelUrl(modelUrl)

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    overflow: hidden;
  }
  model-viewer {
    width: 100%;
    height: 100%;
    --poster-color: transparent;
    --progress-bar-color: transparent;
    background-color: transparent;
  }
</style>
</head>
<body>
<model-viewer
  id="viewer"
  src="${safeUrl}"
  camera-controls
  auto-rotate
  style="width:100%;height:100%;background-color:transparent"
></model-viewer>
<script>
  (function () {
    var post = function (payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    };
    var notified = false;
    var notifyLoaded = function () {
      if (notified) return;
      notified = true;
      post({ type: 'loaded' });
    };
    var viewer = document.getElementById('viewer');
    if (!viewer) {
      post({ type: 'error', message: 'no-viewer' });
      return;
    }
    viewer.addEventListener('load', notifyLoaded);
    viewer.addEventListener('error', function (e) {
      post({
        type: 'error',
        message: (e && e.detail && e.detail.type) || 'unknown',
      });
    });
    // Fallback poll: addEventListener('load') can race with the custom-element
    // upgrade for <model-viewer>, so also poll the loaded property.
    var pollCount = 0;
    var poll = setInterval(function () {
      pollCount++;
      if (viewer.loaded) {
        clearInterval(poll);
        notifyLoaded();
      } else if (pollCount > 150) {
        // ~30s; give up polling
        clearInterval(poll);
      }
    }, 200);
  })();
</script>
</body>
</html>`
}
