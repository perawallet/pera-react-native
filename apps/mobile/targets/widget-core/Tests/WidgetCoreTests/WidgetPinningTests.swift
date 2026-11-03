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
import Security
import XCTest
@testable import WidgetCore

final class WidgetPinningTests: XCTestCase {
    // Throwaway self-signed certificates (base64 DER), one per key shape the pins can hold. Expected hashes are from
    //   openssl x509 -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | base64
    // the command pins.ts documents for the app's own pins.
    private let certificates: [(der: String, hash: String)] = [
        // RSA 2048
        (
            """
            MIIDBTCCAe2gAwIBAgIUJafAVwALM5yrCPiGkyxEwWaZ4qkwDQYJKoZIhvcNAQELBQAwEjEQMA4GA1UEAwwHcnNhMjA0ODAeFw0y
            NjExMDMxMjA0NThaFw0zNjEwMzExMjA0NThaMBIxEDAOBgNVBAMMB3JzYTIwNDgwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
            AoIBAQCjyzn1G9/dcBvFGcPtcMz9aYMP71IN0B2c9QJm/wiyohSm6X3/SPawAs6MIp5OEzFnrgaNGCfycpyy1SHyWNmlTTgd5wcI
            dFXl0A2UfhR+jBZvjtQRSTlZJVBa5IqqmnHkTS+kNozxlL800UELJ2xPbfTjxvW/1EJUpFrTaXjWSbByWF6Nh1aW0hJyQj7FkRKp
            rzeA5hLUbPI4PEMwttkF0Y6nu1+zHgLJyMdwIGwZAsGx9XK69e+Fww5uno4auahffv0nDOs0nm6LSTYI3t9ngzSxyEtY0uKu7Jdw
            W/LxannsCfVGLRxWl0FXE9UAodS9VmaoGHy4Rtc9HTAbMPfhAgMBAAGjUzBRMB0GA1UdDgQWBBRVrNFHaMsF2y7WwHukmzepqAiT
            VzAfBgNVHSMEGDAWgBRVrNFHaMsF2y7WwHukmzepqAiTVzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQB9IyOR
            3dRhldDngQxXcfFcNnV/wgjKudY+rPaYlXj+/18viBgAcllm9j51+1Nlxpsezab4s8F2LShm1vS+2VVWyaW/n/8NRF1dxCJRZ684
            V4zb328YfaH/0IVAbNQLG/tOlfwHymQJOX+PbM6SaFwGdPcdxT6LL5SV6wH4O6srUcjKEjVqC4nmeGr922/9rsq2ZreCJ4xPJBwR
            jdiNgwup8sFZYnq+GMukPgTp10Fpfby4IrrpVPBvsspeS1MDYRcZHO36N2mXAVkGg9oI2x1uKRcad1VnzIU+WSZk2KK6F4KY/gng
            2pFp7KmxcFokLpiikJJavxBmnYlYxxNne+mw
            """,
            "++88BGH24WheB3RjNG5rxyMp0ydxfdSR4wXv8SMoeSU="
        ),
        // RSA 4096
        (
            """
            MIIFBTCCAu2gAwIBAgIUZRWgpsOszUUTSsovOzMAHezjy8EwDQYJKoZIhvcNAQELBQAwEjEQMA4GA1UEAwwHcnNhNDA5NjAeFw0y
            NjExMDMxMjA0NTlaFw0zNjEwMzExMjA0NTlaMBIxEDAOBgNVBAMMB3JzYTQwOTYwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK
            AoICAQDarRbmTp4GpTfCONxqYbc3XUWpvO5gNdaenjixC2E2/cgyTAhXFaZ8EsYXXl5Kq5c5S6jKEmkH8okq8W9WEPfWVap5UTT+
            WBhvCSPNzU6QP2SyQKx6Ru6u/KOOG9WE0jiWI0MjRdu0NkJkwcf8DH2/WwM4JsVheZN8/4IQKRKWex3IiM8Pg0roDipNywUJ0Fb0
            EMx8zy+kkXUYchejvdohZ0HRdMppfvBE9N31Juh4SfHWRdRXePUhJmeHzTCx7a51g88pvNxM4M6LrE6k/iU9xufEOKWhl5lb+VBE
            8/vPoOxCBFnGJVe0QL10oSZEQYqj1n4KSjuCbihnkGBtcWfKH1j5Gj+Yzp/IKVu+sVxQybwHuu1C+3vDEjUTCw677xSFV3QTkkZs
            qsU0rpX6xzfAblNB/35/3oHMZ4khe9DdoEY5O44luSRcrUHeqyADRqjrfK6xxuBocCbrCu03iUwS7KXLwSu2HMvpwEdJDFzalJZP
            1IPoTX/oUKbNIreHGvgpRYnp0BlZnZlQJucX+L9x6AQOEscAKgMsKtCz9Wy1NlaIgxRfeniH4mQfSDmlxZP6uevmdpHp7446HOTE
            B57ywNMMOqdIxwzQwOKndZZdEDashgX+rWi6Wl54QjlTazMroRdK+PqsF5lowMKpI/pUkv0XdGtBlcHYgpg5WlFMkQIDAQABo1Mw
            UTAdBgNVHQ4EFgQUvyXv4X7IFqX1EMhkI/i7xNyJLhswHwYDVR0jBBgwFoAUvyXv4X7IFqX1EMhkI/i7xNyJLhswDwYDVR0TAQH/
            BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAgEAHXQDHQMzI0yrYefHO5lqpppvQlUPZQKkEeFakd0HUjq9cPJUp9Vk9Xtl8s81f+yK
            sc2T/j0u2IDK/aLcbxoJCYtxOB19mkJN5a0AMsdkvg7/8TD3OsHJxhGNy6T3i97DlYOY47oOmmxARrOjF4jFwAgg9M2p1X2/kdek
            zirw91T/EjHT7mujazW8mCMJ9ezY7fSNt2PKXeD2GcQNS34XKW3A668iOUCjoSAg9XIgqOlIgVwgVqG6SKM90Jrf6CdrE0auK9h4
            Ycsg2fOgiZfQe7daL+G37n7NxqMX+LjXOrMDiJf19sC+YlgUuL4qrrOY9OM4fBbIpFG7hPXHwcglfN4Hu09YIsRA9Sugs5Ytfjxk
            0ZGoTv7ikS9DjwfRqx1SdS53ejA9BPQIpJjSSSP75yTmeBl8TEXW4IQSTQADqb6g6rzIyQVTMLfwufNK/j63EG/4JpDFRGK5emxo
            ppEoiKYbchm8vIUxkdouZYavH0hLXNk3Ap7rrEAaoDPZl45POEX4lKLOYLG/p0C5Zafz/V/noAOEgeWWIoA1PEJzN+xoemN4WVCw
            B0YDqYwE8vnXJgH0vY0gNL101eIrwuraSEgdgrs59pRijoMFl3SU0Zaa09ipSO4NDGJ0fZ+4IKKi52VbgieZSWm6GhrzmH1pMiKy
            25ilyR76NZGJyOJ+bSE=
            """,
            "WKv+II6EznqhrXvzOGKWG4VkgK8fGGfxdPEFIbnAirU="
        ),
        // EC P-256
        (
            """
            MIIBdDCCARmgAwIBAgIUWmY89PVqLB1B0e895RYt/3q64IEwCgYIKoZIzj0EAwIwDzENMAsGA1UEAwwEcDI1NjAeFw0yNjExMDMx
            MjA0NTlaFw0zNjEwMzExMjA0NTlaMA8xDTALBgNVBAMMBHAyNTYwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASUIb1baLemiEgU
            3gtB4jA3D0ipSDYUih+e0oO4KomvgEaCVehgyqP4ew5zFRTEmprUXNMKc6B4heIgG41x7IYHo1MwUTAdBgNVHQ4EFgQUHTUygx0X
            +G32HqXYdycSvWXopykwHwYDVR0jBBgwFoAUHTUygx0X+G32HqXYdycSvWXopykwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQD
            AgNJADBGAiEAw+AZVcyg1H5sM8AdjVwgDWQZoArXcUdgJuayw4A0v38CIQCZ1t7UCje+GaZiVdOgLzZ3lK/z4bBvTjziDWTP1nZR
            1w==
            """,
            "OPYpkFmyA5pjDrSdtkzoIPY2A+rqP4Bj9gzqOB/pzW4="
        ),
        // EC P-384
        (
            """
            MIIBsDCCATagAwIBAgIUEbUv+2SVjROuqab0K+FLsJh1ZJswCgYIKoZIzj0EAwIwDzENMAsGA1UEAwwEcDM4NDAeFw0yNjExMDMx
            MjA0NTlaFw0zNjEwMzExMjA0NTlaMA8xDTALBgNVBAMMBHAzODQwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAASDorg8eZt9e9zM8ldg
            D/OvlnkpGGzE+BXp8mQpbcJh2ZH8P1+A0/ojgKJlRtktHAD+HXIzXBgT2/9wizySrlczNJ4Vtan27j10GsgI53rEkJDHGL1Vbq59
            UiRlrLgyqhyjUzBRMB0GA1UdDgQWBBQ2a0XwM46KwGQVgJdM90Auz4+1IjAfBgNVHSMEGDAWgBQ2a0XwM46KwGQVgJdM90Auz4+1
            IjAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA2gAMGUCMQCXkSoFt9DC7NASMynX4ppuwND1qqDNMS6cdbPshoyXQR0SkwBf
            QXlitf8A+EC7FaYCMAPediwz7ySR6wZoZH/ZRB1BRg/w5AVkJbXHbLF+zsLaZsF1hIU5n1bT9LF9FnfkwA==
            """,
            "bg8LzNgLYz+EPp4aWlpbbPRTf/rAZX4+sLyXhM6p7n8="
        ),
    ]

    func testHashesTheSubjectPublicKeyInfoOfEveryPinnableKeyShape() throws {
        for (der, hash) in certificates {
            let data = try XCTUnwrap(Data(base64Encoded: der, options: .ignoreUnknownCharacters))
            let certificate = try XCTUnwrap(SecCertificateCreateWithData(nil, data as CFData))

            XCTAssertEqual(WidgetPinning.spkiHash(certificate), hash)
        }
    }

    func testPinsUntilTheyExpire() {
        let now = ISODate.parse("2026-11-03T12:00:00Z")!

        XCTAssertTrue(WidgetPinning.isActive(expiresAt: "2027-07-08", now: now))
        XCTAssertTrue(WidgetPinning.isActive(expiresAt: "2027-07-08T00:00:00Z", now: now))
        XCTAssertFalse(WidgetPinning.isActive(expiresAt: "2026-01-01", now: now))
        XCTAssertNil(WidgetPinning.session(hashes: ["pin="], expiresAt: "2026-01-01", now: now))
    }

    func testAnUnreadableExpiryKeepsThePins() {
        XCTAssertTrue(WidgetPinning.isActive(expiresAt: "someday", now: .now))
    }
}
