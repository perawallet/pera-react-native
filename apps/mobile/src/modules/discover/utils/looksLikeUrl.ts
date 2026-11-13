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

const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:\/\//i;
const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
const HOST_END = /[/?#:]/;

/**
 * Whether typed search text is meant as a web address. A regex rather than
 * `new URL`, so Jest and React Native agree. A scheme is accepted here and
 * `toValidatedBrowserUrl` then rejects everything but https, so `http://` and
 * `javascript:` text never becomes an openable URL.
 */
export const looksLikeUrl = (query: string): boolean => {
  const q = query.trim();
  if (/\s/.test(q)) return false;
  if (SCHEME_PREFIX.test(q)) return true;
  const host = q.split(HOST_END, 1)[0] ?? "";
  return HOST.test(host);
};
