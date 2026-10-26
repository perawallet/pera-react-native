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

import AuthenticationServices
import ExpoModulesCore

public class PeraGoogleAuthModule: Module {
  // ASWebAuthenticationSession holds its presentation provider weakly, and a
  // session that is deallocated mid-flight dismisses itself.
  private var session: ASWebAuthenticationSession?
  private let presentationAnchor = KeyWindowAnchor()

  public func definition() -> ModuleDefinition {
    Name("PeraGoogleAuth")

    // Resolves the redirect URL, or nil when the user closes the sheet.
    AsyncFunction("authenticate") { (url: URL, callbackScheme: String, promise: Promise) in
      // Replacing an open session would deallocate it with its promise
      // unsettled, and its completion would then nil out the new one.
      guard self.session == nil else {
        promise.reject("ERR_GOOGLE_AUTH", "An authentication session is already open")
        return
      }
      let session = ASWebAuthenticationSession(
        url: url,
        callbackURLScheme: callbackScheme
      ) { [weak self] callbackURL, error in
        self?.session = nil
        if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
          promise.resolve(nil)
        } else if let error {
          promise.reject("ERR_GOOGLE_AUTH", error.localizedDescription)
        } else {
          promise.resolve(callbackURL?.absoluteString)
        }
      }
      // Keeps Google's own sign-in cookie, so the consent page offers the
      // signed-in accounts instead of a blank login.
      session.prefersEphemeralWebBrowserSession = false
      session.presentationContextProvider = presentationAnchor
      self.session = session
      if !session.start() {
        self.session = nil
        promise.reject("ERR_GOOGLE_AUTH", "The authentication session did not start")
      }
    }.runOnQueue(.main)
  }
}

private final class KeyWindowAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first { $0.isKeyWindow } ?? ASPresentationAnchor()
  }
}
