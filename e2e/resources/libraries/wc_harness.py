"""Control surface of the host-side WalletConnect v1 dApp harness, reached at WC_HARNESS_URL."""

import json
import os
from urllib.parse import quote
from urllib.request import Request, urlopen


def _call(path, body=None):
    base = os.environ["WC_HARNESS_URL"].rstrip("/")
    data = None if body is None else body.encode()
    # Creating a session waits on the bridge, so allow longer than a status read needs.
    with urlopen(Request(base + path, data=data), timeout=30) as response:
        return json.loads(response.read() or b"{}")


def fresh_wc_deeplink():
    """Opens a new dApp session and returns the Pera deeplink that carries its wc: URI."""
    uri = _call("/uri").get("uri") or ""
    if not uri.startswith("wc:"):
        raise AssertionError(f"Harness returned no wc: URI: {uri!r}")
    return "perawallet-wc://wc?uri=" + quote(uri, safe="")


def harness_status():
    return _call("/status")


def harness_sign_result():
    return _call("/sign-result")


def send_harness_request(path, body=""):
    """POSTs a dApp request; the harness answers at once and the outcome lands in /sign-result."""
    return _call(path, body)
