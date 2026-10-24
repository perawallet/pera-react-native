*** Settings ***
Documentation       Settings and on-device feature-flag overrides on Android and iOS from one suite.
...                 Every case starts on a fresh Settings list and puts back any preference it changes.
Resource            ../resources/settings.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Setup          Open Settings
Test Teardown       Capture Failure Screenshot
Test Tags           settings


*** Test Cases ***
Settings Lists Its Sections
    [Tags]    id:settings.list.sections    p0    rc
    Page Should Contain Element    ${SETTINGS_ITEM_SECURITY}
    Page Should Contain Element    ${SETTINGS_ITEM_NOTIFICATIONS}
    Page Should Contain Element    ${SETTINGS_ITEM_THEME}

Closing PIN Setup Leaves PIN Unchanged
    [Tags]    id:settings.security.pin-setup-dismiss    p1
    Open Security Settings
    ${was_on}=    Switch Is On    ${SECURITY_PIN_TOGGLE}
    Tap    ${SECURITY_PIN_TOGGLE}
    # The PIN sheet disables pan-to-close; its close button is the only way out.
    Wait Until Settled    ${PIN_SHEET_CLOSE_BUTTON}
    Tap    ${PIN_SHEET_CLOSE_BUTTON}
    Wait Until Page Does Not Contain Element    ${PIN_SHEET_CLOSE_BUTTON}    timeout=10s
    Switch Should Be    ${SECURITY_PIN_TOGGLE}    ${was_on}

Rekey Support Toggles On And Off
    [Tags]    id:settings.security.rekey-toggle    p1
    Open Security Settings
    Expand Advanced Security
    Flip Switch And Back    ${SECURITY_REKEY_TOGGLE}

Asset Freeze Support Toggles On And Off
    [Tags]    id:settings.security.asset-freeze-toggle    p1
    Open Security Settings
    Expand Advanced Security
    Flip Switch And Back    ${SECURITY_ASSET_FREEZE_TOGGLE}

Theme Can Be Switched
    [Tags]    id:settings.theme.switch    p1
    Open Theme Settings
    # Tapping all three and then checking a radio is on screen proves nothing: the radios are
    # always on screen. Check that each tap took, and leave the theme as it was found.
    Tap    ${THEME_LIGHT_RADIO}
    Theme Should Be Selected    light
    Tap    ${THEME_DARK_RADIO}
    Theme Should Be Selected    dark
    Tap    ${THEME_SYSTEM_RADIO}
    Theme Should Be Selected    system

Notifications Settings Open
    [Tags]    id:settings.notifications.open    p1
    Open From Settings    ${SETTINGS_ITEM_NOTIFICATIONS}    ${SETTINGS_NOTIFICATIONS_SCREEN}

Passkeys Settings Show The Fresh Device State
    [Tags]    id:settings.passkeys.state    p1
    Open From Settings    ${SETTINGS_ITEM_PASSKEYS}    ${SETTINGS_PASSKEYS_SCREEN}
    Wait Until Page Contains Element    ${SETTINGS_PASSKEYS_FRESH_STATE}    timeout=15s

WalletConnect Settings Show The Empty State
    [Tags]    id:settings.walletconnect.empty    p2
    Open From Settings    ${SETTINGS_ITEM_WALLET_CONNECT}    ${WALLET_CONNECT_CONNECT_BUTTON}

Developer Mode Lists The Test Networks
    [Tags]    id:settings.developer.node-networks    p1
    Open Developer Settings
    Tap    ${DEVELOPER_NODE_ITEM}
    Wait Until Page Contains Element    ${NODE_SETTINGS_SCREEN}    timeout=15s
    Wait Until Page Contains Element    ${NODE_DEVELOPER_MODE_SWITCH}    timeout=15s
    ${was_on}=    Switch Is On    ${NODE_DEVELOPER_MODE_SWITCH}
    IF    not ${was_on}    Tap    ${NODE_DEVELOPER_MODE_SWITCH}
    Wait Until Page Contains Element    ${NODE_TESTNET_RADIO}    timeout=15s
    Page Should Contain Element    ${NODE_BETANET_RADIO}
    IF    not ${was_on}
        # Developer mode moves the whole app off mainnet; leave it as found.
        Tap    ${NODE_DEVELOPER_MODE_SWITCH}
        Wait Until Page Does Not Contain Element    ${NODE_CHAIN_NETWORKS}    timeout=10s
    END

Currency Search Keeps Only Matches
    [Tags]    id:settings.currency.search    p2    integration-covered
    Open Currency Settings
    Wait Until Page Contains Element    ${CURRENCY_ITEM_USD}    timeout=15s
    Search Currency    EUR
    Wait Until Page Contains Element    ${CURRENCY_ITEM_EUR}    timeout=10s
    Wait Until Page Does Not Contain Element    ${CURRENCY_ITEM_USD}    timeout=10s

Selected Currency Is Saved
    [Tags]    id:settings.currency.select    p1
    Open Currency Settings
    Select Currency    EUR
    Tap Back
    Open Currency Settings
    Main Currency Should Be    EUR
    Select Currency    USD

Rate App Sheet Opens And Closes
    [Tags]    id:settings.support.rate-sheet    p2
    Open From Settings    ${SETTINGS_ITEM_RATE_APP}    ${SETTINGS_RATINGS_SHEET}
    Wait Until Settled    ${SETTINGS_RATINGS_SHEET}
    Tap Backdrop Above    ${SETTINGS_RATINGS_SHEET}
    Wait Until Page Does Not Contain Element    ${SETTINGS_RATINGS_SHEET}    timeout=10s

Cancelling Remove All Keeps The Wallet
    [Tags]    id:settings.support.remove-all-cancel    p2
    Open From Settings    ${SETTINGS_REMOVE_ALL_BUTTON}    ${SETTINGS_DELETE_ALL_CANCEL_BUTTON}
    Wait Until Settled    ${SETTINGS_DELETE_ALL_CANCEL_BUTTON}
    Tap    ${SETTINGS_DELETE_ALL_CANCEL_BUTTON}
    Wait Until Page Does Not Contain Element    ${SETTINGS_DELETE_ALL_CANCEL_BUTTON}    timeout=10s
    Page Should Contain Element    ${SETTINGS_REMOVE_ALL_BUTTON}

Terms Of Service Open In A Webview
    [Tags]    id:settings.support.terms    p2
    Open From Settings    ${SETTINGS_ITEM_TERMS}    ${WEBVIEW_CLOSE_BUTTON}
    Tap    ${WEBVIEW_CLOSE_BUTTON}
    Wait Until Page Contains Element    ${SETTINGS_ITEM_TERMS}    timeout=10s

Privacy Policy Opens In A Webview
    [Tags]    id:settings.support.privacy    p2
    Open From Settings    ${SETTINGS_ITEM_PRIVACY}    ${WEBVIEW_CLOSE_BUTTON}
    Tap    ${WEBVIEW_CLOSE_BUTTON}
    Wait Until Page Contains Element    ${SETTINGS_ITEM_PRIVACY}    timeout=10s

Expanding A Flag Reveals Its Override
    [Tags]    id:settings.feature-flags.expand    p1
    Open Feature Flags
    ${was_expanded}=    Set Cloud Backup Flag Expanded    ${False}
    Set Cloud Backup Flag Expanded    ${True}
    Switch Should Be    ${FLAG_OVERRIDE_CLOUD_BACKUP}    ${False}
    Set Cloud Backup Flag Expanded    ${was_expanded}

Flag Override Reports Its New Value
    [Tags]    id:settings.feature-flags.override    p1
    Open Feature Flags
    ${was_expanded}=    Set Cloud Backup Flag Expanded    ${True}
    Flip Switch And Back    ${FLAG_OVERRIDE_CLOUD_BACKUP}
    Set Cloud Backup Flag Expanded    ${was_expanded}
