*** Settings ***
Library             String
Resource            app.resource


*** Variables ***
${MENU_SETTINGS_BUTTON}                 accessibility_id=menu_settings_button
${SETTINGS_ITEM_SECURITY}               accessibility_id=settings_item_security
${SETTINGS_ITEM_NOTIFICATIONS}          accessibility_id=settings_item_notifications
${SETTINGS_ITEM_WALLET_CONNECT}         accessibility_id=settings_item_walletconnect_sessions
${SETTINGS_ITEM_PASSKEYS}               accessibility_id=settings_item_passkeys
${SETTINGS_ITEM_CURRENCY}               accessibility_id=settings_item_currency
${SETTINGS_ITEM_THEME}                  accessibility_id=settings_item_theme
${SETTINGS_ITEM_RATE_APP}               accessibility_id=settings_item_rate_pera_wallet
${SETTINGS_ITEM_TERMS}                  accessibility_id=settings_item_terms_and_services
${SETTINGS_ITEM_PRIVACY}                accessibility_id=settings_item_privacy_policy
${SETTINGS_ITEM_DEVELOPER}              accessibility_id=settings_item_developer_settings
${SETTINGS_REMOVE_ALL_BUTTON}           accessibility_id=settings_remove_all_accounts_button
${SETTINGS_DELETE_ALL_CANCEL_BUTTON}    accessibility_id=settings_delete_all_cancel_button
# Ids set as a bare testID on a container or Pressable reach Android as resource-id only, never
# content-desc, so accessibility_id cannot see them there.
${SETTINGS_APP_VERSION}                 xpath=//*[@resource-id='settings_app_version' or @name='settings_app_version']
${SETTINGS_RATINGS_SHEET}               xpath=//*[@resource-id='settings_ratings_bottom_sheet' or @name='settings_ratings_bottom_sheet']
${SETTINGS_NOTIFICATIONS_SCREEN}        xpath=//*[@resource-id='settings_notifications_screen' or @name='settings_notifications_screen']
${SETTINGS_PASSKEYS_SCREEN}             xpath=//*[@resource-id='settings_passkeys_screen' or @name='settings_passkeys_screen']
# A fresh device has no passkey provider (disabled) or a provider with no passkeys (empty).
${SETTINGS_PASSKEYS_FRESH_STATE}        xpath=//*[@resource-id='settings_passkeys_disabled_state' or @name='settings_passkeys_disabled_state' or @resource-id='settings_passkeys_empty_state' or @name='settings_passkeys_empty_state']

${SECURITY_PIN_TOGGLE}                  accessibility_id=settings_security_pin_toggle
${SECURITY_REKEY_TOGGLE}                accessibility_id=settings_security_rekey_toggle
${SECURITY_ASSET_FREEZE_TOGGLE}         accessibility_id=settings_security_asset_freeze_toggle
${PIN_SHEET_CLOSE_BUTTON}               accessibility_id=close-button
# The panel header has no testID; its title is the only handle.
${SECURITY_ADVANCED_PANEL_HEADER}       xpath=//*[@text='Advanced Security Settings' or @label='Advanced Security Settings']

${THEME_SYSTEM_RADIO}                   accessibility_id=settings_theme_system_radio
${THEME_LIGHT_RADIO}                    accessibility_id=settings_theme_light_radio
${THEME_DARK_RADIO}                     accessibility_id=settings_theme_dark_radio

${CURRENCY_SEARCH_INPUT}                accessibility_id=settings_currency_search_input
${CURRENCY_ITEM_USD}                    accessibility_id=settings_currency_item_usd
${CURRENCY_ITEM_EUR}                    accessibility_id=settings_currency_item_eur
${CURRENCY_ITEM_ALGO}                   accessibility_id=settings_currency_item_algo

${DEVELOPER_NODE_ITEM}                  accessibility_id=developer_settings_node_item
${DEVELOPER_DEBUG_TOOLS_ITEM}           accessibility_id=developer_settings_debug_tools_item
${NODE_DEVELOPER_MODE_SWITCH}           accessibility_id=node_settings_developer_mode_switch
${NODE_SETTINGS_SCREEN}                 xpath=//*[@resource-id='node_settings_screen' or @name='node_settings_screen']
${NODE_CHAIN_NETWORKS}                  xpath=//*[@resource-id='node_settings_chain_networks' or @name='node_settings_chain_networks']
# Mainnet has no row: it is the live-mode default, and only the testnet-tier networks are listed.
${NODE_TESTNET_RADIO}                   accessibility_id=node_settings_algorand_testnet_radio
${NODE_BETANET_RADIO}                   accessibility_id=node_settings_algorand_betanet_radio

${WALLET_CONNECT_CONNECT_BUTTON}        accessibility_id=wallet_connect_connect_button
${WEBVIEW_CLOSE_BUTTON}                 accessibility_id=webview_close_button

${DEBUG_TOOLS_FEATURE_FLAGS_ITEM}       accessibility_id=debug_tools_feature_flags_item
# The toast has no testID; its text is the only handle.
${DEBUG_TOOLS_ENABLED_TOAST}            xpath=//*[@text='Debug tools enabled' or @label='Debug tools enabled']
${CLOUD_BACKUP_FLAG}                    enable_cloud_backup
${FLAG_EXPAND_CLOUD_BACKUP}             accessibility_id=feature_flag_expand_${CLOUD_BACKUP_FLAG}
${FLAG_OVERRIDE_CLOUD_BACKUP}           accessibility_id=feature_flag_override_${CLOUD_BACKUP_FLAG}


*** Keywords ***
Scroll To
    [Documentation]    Brings an element on screen in one driver call. Takes this file's locators:
    ...                accessibility_id=<id>, or an xpath on a bare testID (a resource-id on Android).
    [Arguments]    ${locator}
    ${bare}=    Get Regexp Matches    ${locator}    @resource-id='([^']+)'    1
    IF    ${bare}
        Scroll Into View    ${bare}[0]    by=resourceId
    ELSE
        Scroll Into View    ${locator.split('=', 1)[1]}
    END

Is Visible
    [Documentation]    Instant probe: one check, no retry.
    [Arguments]    ${locator}
    ${visible}=    Run Keyword And Return Status
    ...    Expect Element    ${locator}    visible    timeout=1ms    retry_interval=0s    loglevel=NONE
    RETURN    ${visible}

Open From Settings
    [Arguments]    ${item}    ${anchor}
    Scroll To    ${item}
    Tap    ${item}
    Wait Until Page Contains Element    ${anchor}    timeout=15s

Switch State Locator
    [Documentation]    Android exposes a switch's state as checked, iOS as value 1/0.
    [Arguments]    ${locator}    ${on}
    ${id}=    Set Variable    ${{ $locator.split('=', 1)[1] }}
    IF    ${on}
        RETURN    xpath=//*[(@content-desc='${id}' or @name='${id}') and (@checked='true' or @value='1')]
    END
    RETURN    xpath=//*[(@content-desc='${id}' or @name='${id}') and (@checked='false' or @value='0')]

Switch Is On
    [Arguments]    ${locator}
    Wait Until Page Contains Element    ${locator}    timeout=15s
    ${on_locator}=    Switch State Locator    ${locator}    ${True}
    ${on}=    Run Keyword And Return Status    Page Should Contain Element    ${on_locator}
    RETURN    ${on}

Switch Should Be
    [Arguments]    ${locator}    ${on}
    ${state}=    Switch State Locator    ${locator}    ${on}
    Wait Until Page Contains Element    ${state}    timeout=10s

Flip Switch And Back
    [Documentation]    Proves the switch changes state both ways and leaves it as it was found.
    [Arguments]    ${locator}
    ${was_on}=    Switch Is On    ${locator}
    Tap    ${locator}
    Switch Should Be    ${locator}    ${{ not $was_on }}
    Tap    ${locator}
    Switch Should Be    ${locator}    ${was_on}

Open Security Settings
    Open From Settings    ${SETTINGS_ITEM_SECURITY}    ${SECURITY_PIN_TOGGLE}

Expand Advanced Security
    [Documentation]    The panel starts expanded whenever any advanced option is on, and a header
    ...                tap toggles it, so tap only when the toggles are hidden. Collapsed toggles
    ...                stay mounted at zero height, which is why this checks visibility.
    Wait Until Page Contains Element    ${SECURITY_ADVANCED_PANEL_HEADER}    timeout=15s
    ${open}=    Is Visible    ${SECURITY_REKEY_TOGGLE}
    IF    not ${open}    Tap    ${SECURITY_ADVANCED_PANEL_HEADER}
    Scroll To    ${SECURITY_ASSET_FREEZE_TOGGLE}

Open Theme Settings
    Open From Settings    ${SETTINGS_ITEM_THEME}    ${THEME_SYSTEM_RADIO}

Open Currency Settings
    Open From Settings    ${SETTINGS_ITEM_CURRENCY}    ${CURRENCY_SEARCH_INPUT}
    # The list, ALGO row included, stays empty until the backend's currency list answers.
    Wait Until Page Contains Element    ${CURRENCY_ITEM_ALGO}    timeout=30s
    ...    error=Currency list did not load in 30s: the Pera backend's /v1/currencies/ did not answer (network or backend), so there is nothing to pick.

Search Currency
    [Arguments]    ${term}
    Tap    ${CURRENCY_SEARCH_INPUT}
    Input Text    ${CURRENCY_SEARCH_INPUT}    ${term}
    # With the keyboard up, the first tap on a result only dismisses the keyboard.
    Dismiss Keyboard

Select Currency
    [Arguments]    ${code}
    Search Currency    ${code}
    Tap    accessibility_id=settings_currency_item_${{ $code.lower() }}
    Main Currency Should Be    ${code}

Main Currency Should Be
    [Documentation]    The screen's description names the saved preferred currency.
    [Arguments]    ${code}
    Wait Until Page Contains Element
    ...    xpath=//*[contains(@text,'main currency is ${code}') or contains(@label,'main currency is ${code}')]
    ...    timeout=10s

Open Developer Settings
    Open From Settings    ${SETTINGS_ITEM_DEVELOPER}    ${DEVELOPER_NODE_ITEM}

Unlock Debug Tools
    [Documentation]    Ten taps on the version row, each within 1s of the last or the app restarts
    ...                the count. Resolving the point once keeps every gap to one tap round trip.
    Scroll To    ${SETTINGS_APP_VERSION}
    ${location}=    Get Element Location    ${SETTINGS_APP_VERSION}
    ${size}=    Get Element Size    ${SETTINGS_APP_VERSION}
    VAR    @{point}    ${{ int($location['x'] + $size['width'] / 2) }}    ${{ int($location['y'] + $size['height'] / 2) }}
    # ponytail: one request per tap; a remote grid slower than ~1s per round trip needs a single
    # W3C action sequence instead.
    AppiumLibrary.Tap    ${point}    count=10    duration=50ms
    Wait Until Page Contains Element    ${DEBUG_TOOLS_ENABLED_TOAST}    timeout=10s
    # The toast covers the top rows for ~3s and swallows taps there. iOS keeps it in the tree
    # off-screen once hidden, so wait on visibility rather than presence.
    Wait Until Keyword Succeeds    10s    0.3s    Should Not Be Visible    ${DEBUG_TOOLS_ENABLED_TOAST}

Should Not Be Visible
    [Arguments]    ${locator}
    ${visible}=    Is Visible    ${locator}
    Should Not Be True    ${visible}

Open Feature Flags
    Unlock Debug Tools
    Open From Settings    ${SETTINGS_ITEM_DEVELOPER}    ${DEVELOPER_DEBUG_TOOLS_ITEM}
    Tap    ${DEVELOPER_DEBUG_TOOLS_ITEM}
    Wait Until Page Contains Element    ${DEBUG_TOOLS_FEATURE_FLAGS_ITEM}    timeout=15s
    Tap    ${DEBUG_TOOLS_FEATURE_FLAGS_ITEM}
    Scroll To    ${FLAG_EXPAND_CLOUD_BACKUP}

Set Cloud Backup Flag Expanded
    [Documentation]    Expanding a flag creates its override (off); collapsing removes it.
    [Arguments]    ${expanded}
    ${now}=    Run Keyword And Return Status    Page Should Contain Element    ${FLAG_OVERRIDE_CLOUD_BACKUP}
    IF    $now != $expanded    Tap    ${FLAG_EXPAND_CLOUD_BACKUP}
    IF    ${expanded}
        Wait Until Page Contains Element    ${FLAG_OVERRIDE_CLOUD_BACKUP}    timeout=10s
    ELSE
        Wait Until Page Does Not Contain Element    ${FLAG_OVERRIDE_CLOUD_BACKUP}    timeout=10s
    END
    RETURN    ${now}

Tap Backdrop Above
    [Documentation]    Closes a short sheet by tapping the dimmed backdrop halfway above it. Hardware
    ...                back is blocked while a sheet is open, and a swipe on the backdrop is no tap.
    [Arguments]    ${sheet}
    ${location}=    Get Element Location    ${sheet}
    ${width}=    Get Window Width
    VAR    @{point}    ${{ int($width / 2) }}    ${{ int($location['y'] / 2) }}
    # The backdrop's tap recognizer rejects the default press, which is held too long to be a tap.
    AppiumLibrary.Tap    ${point}    duration=50ms
