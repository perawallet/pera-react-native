# google-auth

Local Expo module implementing the `PeraGoogleAuth` native module behind
`extensions/platform-react-native/src/services/cloud-file-storage/google-auth.ts`.
Autolinked via `expo.autolinking.nativeModulesDir`, with no config plugin or
manual registration.

Google Drive backup needs a short-lived `drive.file` access token, not a
signed-in Google profile. Hand-rolling it keeps the Google Sign-In SDK out of
the graph, along with its App Check dependency, which would otherwise have to
resolve alongside Firebase's.

| Platform | Native call                             | Flow                                                                                                                                                       |
| -------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iOS      | `authenticate(url, callbackScheme)`     | Runs Google's consent page in an `ASWebAuthenticationSession` and returns the redirect URL. PKCE, the `state` check and the token exchange happen in JS.   |
| Android  | `authorize(scope)`, `clearToken(token)` | The system account chooser, then Google Identity Services' `AuthorizationClient` for that account, which shows UI only when the scope still needs consent. |

Both resolve `null` when the user backs out.

## Traps

- `drive.file` is scoped to the Google Cloud project. A different project's
  OAuth client cannot see backups an earlier build wrote.
- iOS uses the iOS OAuth client (`GOOGLE_IOS_CLIENT_ID`) with no client secret,
  redirecting to the client id's reversed form. The session catches that
  redirect itself, so the scheme needs no `CFBundleURLTypes` entry.
- Android needs no client id. It authorizes against the Android OAuth client
  registered for the app's package name and signing-key SHA-1, which must exist
  in the same Cloud project for every signing key, debug included.
- Android must pass an explicit account. Without one, `AuthorizationClient`
  can silently reuse the last account it authorized, so a user whose backup is on
  another account can't switch. The chooser returns at once on a device with a
  single Google account.
- `authorize` runs on the main queue: `makeGooglePlayServicesAvailable` throws
  anywhere else, and Expo runs `AsyncFunction`s on a background queue.
- The refresh token iOS receives is dropped, so nothing outlives a session.
  Android caches access tokens itself, and `clearToken` is how a rejected or
  finished one is released.
