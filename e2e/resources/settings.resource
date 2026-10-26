*** Settings ***
Library             String
Resource            app.resource


*** Variables ***
${MENU_SETTINGS_BUTTON}                 xpath=//*[@resource-id='menu_settings_button' or @name='menu_settings_button' or @content-desc='menu_settings_button']
${SETTINGS_ITEM_SECURITY}               xpath=//*[@resource-id='settings_item_security' or @name='settings_item_security' or @content-desc='settings_item_security']
${SETTINGS_ITEM_NOTIFICATIONS}          xpath=//*[@resource-id='settings_item_notifications' or @name='settings_item_notifications' or @content-desc='settings_item_notifications']
${SETTINGS_ITEM_WALLET_CONNECT}         xpath=//*[@resource-id='settings_item_walletconnect_sessions' or @name='settings_item_walletconnect_sessions' or @content-desc='settings_item_walletconnect_sessions']
${SETTINGS_ITEM_PASSKEYS}               xpath=//*[@resource-id='settings_item_passkeys' or @name='settings_item_passkeys' or @content-desc='settings_item_passkeys']
${SETTINGS_ITEM_CURRENCY}               xpath=//*[@resource-id='settings_item_currency' or @name='settings_item_currency' or @content-desc='settings_item_currency']
${SETTINGS_ITEM_THEME}                  xpath=//*[@resource-id='settings_item_theme' or @name='settings_item_theme' or @content-desc='settings_item_theme']
${SETTINGS_ITEM_RATE_APP}               xpath=//*[@resource-id='settings_item_rate_pera_wallet' or @name='settings_item_rate_pera_wallet' or @content-desc='settings_item_rate_pera_wallet']
${SETTINGS_ITEM_TERMS}                  xpath=//*[@resource-id='settings_item_terms_and_services' or @name='settings_item_terms_and_services' or @content-desc='settings_item_terms_and_services']
${SETTINGS_ITEM_PRIVACY}                xpath=//*[@resource-id='settings_item_privacy_policy' or @name='settings_item_privacy_policy' or @content-desc='settings_item_privacy_policy']
${SETTINGS_ITEM_DEVELOPER}              xpath=//*[@resource-id='settings_item_developer_settings' or @name='settings_item_developer_settings' or @content-desc='settings_item_developer_settings']
${SETTINGS_REMOVE_ALL_BUTTON}           xpath=//*[@resource-id='settings_remove_all_accounts_button' or @name='settings_remove_all_accounts_button' or @content-desc='settings_remove_all_accounts_button']
${SETTINGS_DELETE_ALL_CANCEL_BUTTON}    xpath=//*[@resource-id='settings_delete_all_cancel_button' or @name='settings_delete_all_cancel_button' or @content-desc='settings_delete_all_cancel_button']
# Ids set as a bare testID on a container or Pressable reach Android as resource-id only, never
# content-desc, so accessibility_id cannot see them there.
${SETTINGS_APP_VERSION}                 xpath=//*[@resource-id='settings_app_version' or @name='settings_app_version']
${SETTINGS_RATINGS_SHEET}               xpath=//*[@resource-id='settings_ratings_bottom_sheet' or @name='settings_ratings_bottom_sheet']
${SETTINGS_NOTIFICATIONS_SCREEN}        xpath=//*[@resource-id='settings_notifications_screen' or @name='settings_notifications_screen']
${SETTINGS_PASSKEYS_SCREEN}             xpath=//*[@resource-id='settings_passkeys_screen' or @name='settings_passkeys_screen']
# A fresh device has no passkey provider (disabled) or a provider with no passkeys (empty).
${SETTINGS_PASSKEYS_FRESH_STATE}        xpath=//*[@resource-id='settings_passkeys_disabled_state' or @name='settings_passkeys_disabled_state' or @resource-id='settings_passkeys_empty_state' or @name='settings_passkeys_empty_state']

${SECURITY_PIN_TOGGLE}                  xpath=//*[@resource-id='settings_security_pin_toggle' or @name='settings_security_pin_toggle' or @content-desc='settings_security_pin_toggle']
${SECURITY_REKEY_TOGGLE}                xpath=//*[@resource-id='settings_security_rekey_toggle' or @name='settings_security_rekey_toggle' or @content-desc='settings_security_rekey_toggle']
${SECURITY_ASSET_FREEZE_TOGGLE}         xpath=//*[@resource-id='settings_security_asset_freeze_toggle' or @name='settings_security_asset_freeze_toggle' or @content-desc='settings_security_asset_freeze_toggle']
${PIN_SHEET_CLOSE_BUTTON}               xpath=//*[@resource-id='close-button' or @name='close-button' or @content-desc='close-button']
# The panel header has no testID; its title is the only handle.
${SECURITY_ADVANCED_PANEL_HEADER}       xpath=//*[@text='Advanced Security Settings' or @label='Advanced Security Settings']

${THEME_SYSTEM_RADIO}                   xpath=//*[@resource-id='settings_theme_system_radio' or @name='settings_theme_system_radio' or @content-desc='settings_theme_system_radio']
${THEME_LIGHT_RADIO}                    xpath=//*[@resource-id='settings_theme_light_radio' or @name='settings_theme_light_radio' or @content-desc='settings_theme_light_radio']
${THEME_DARK_RADIO}                     xpath=//*[@resource-id='settings_theme_dark_radio' or @name='settings_theme_dark_radio' or @content-desc='settings_theme_dark_radio']

${CURRENCY_SEARCH_INPUT}                xpath=//*[@resource-id='settings_currency_search_input' or @name='settings_currency_search_input' or @content-desc='settings_currency_search_input']
${CURRENCY_ITEM_USD}                    xpath=//*[@resource-id='settings_currency_item_usd' or @name='settings_currency_item_usd' or @content-desc='settings_currency_item_usd']
${CURRENCY_ITEM_EUR}                    xpath=//*[@resource-id='settings_currency_item_eur' or @name='settings_currency_item_eur' or @content-desc='settings_currency_item_eur']
${CURRENCY_ITEM_ALGO}                   xpath=//*[@resource-id='settings_currency_item_algo' or @name='settings_currency_item_algo' or @content-desc='settings_currency_item_algo']

${DEVELOPER_NODE_ITEM}                  xpath=//*[@resource-id='developer_settings_node_item' or @name='developer_settings_node_item' or @content-desc='developer_settings_node_item']
${DEVELOPER_DEBUG_TOOLS_ITEM}           xpath=//*[@resource-id='developer_settings_debug_tools_item' or @name='developer_settings_debug_tools_item' or @content-desc='developer_settings_debug_tools_item']
${NODE_DEVELOPER_MODE_SWITCH}           xpath=//*[@resource-id='node_settings_developer_mode_switch' or @name='node_settings_developer_mode_switch' or @content-desc='node_settings_developer_mode_switch']
${NODE_SETTINGS_SCREEN}                 xpath=//*[@resource-id='node_settings_screen' or @name='node_settings_screen']
${NODE_CHAIN_NETWORKS}                  xpath=//*[@resource-id='node_settings_chain_networks' or @name='node_settings_chain_networks']
# Mainnet has no row: it is the live-mode default, and only the testnet-tier networks are listed.
${NODE_TESTNET_RADIO}                   xpath=//*[@resource-id='node_settings_algorand_testnet_radio' or @name='node_settings_algorand_testnet_radio' or @content-desc='node_settings_algorand_testnet_radio']
${NODE_BETANET_RADIO}                   xpath=//*[@resource-id='node_settings_algorand_betanet_radio' or @name='node_settings_algorand_betanet_radio' or @content-desc='node_settings_algorand_betanet_radio']

${WALLET_CONNECT_CONNECT_BUTTON}        xpath=//*[@resource-id='wallet_connect_connect_button' or @name='wallet_connect_connect_button' or @content-desc='wallet_connect_connect_button']
${WEBVIEW_CLOSE_BUTTON}                 xpath=//*[@resource-id='webview_close_button' or @name='webview_close_button' or @content-desc='webview_close_button']

${DEBUG_TOOLS_FEATURE_FLAGS_ITEM}       xpath=//*[@resource-id='debug_tools_feature_flags_item' or @name='debug_tools_feature_flags_item' or @content-desc='debug_tools_feature_flags_item']
# The toast has no testID; its text is the only handle.
${DEBUG_TOOLS_ENABLED_TOAST}            xpath=//*[@text='Debug tools enabled' or @label='Debug tools enabled']
${CLOUD_BACKUP_FLAG}                    enable_cloud_backup
${FLAG_EXPAND_CLOUD_BACKUP}             xpath=//*[@resource-id='feature_flag_expand_${CLOUD_BACKUP_FLAG}' or @name='feature_flag_expand_${CLOUD_BACKUP_FLAG}' or @content-desc='feature_flag_expand_${CLOUD_BACKUP_FLAG}']
${FLAG_OVERRIDE_CLOUD_BACKUP}           xpath=//*[@resource-id='feature_flag_override_${CLOUD_BACKUP_FLAG}' or @name='feature_flag_override_${CLOUD_BACKUP_FLAG}' or @content-desc='feature_flag_override_${CLOUD_BACKUP_FLAG}']


*** Keywords ***
Bare Test Id
    [Documentation]    The testID inside one of this file's locators, whichever shape it has.
    ...                Locators used to be accessibility_id=<id>, so splitting on the first '='
    ...                was enough; they are xpaths now and that split returned the whole
    ...                predicate, which then went back into another xpath and would not parse.
    [Arguments]    ${locator}
    ${bare}=    Get Regexp Matches    ${locator}    @resource-id='([^']+)'    1
    IF    ${bare}    RETURN    ${bare}[0]
    RETURN    ${{ $locator.split('=', 1)[1] }}

Scroll To
    [Documentation]    Brings an element on screen in one driver call.
    [Arguments]    ${locator}
    ${id}=    Bare Test Id    ${locator}
    Scroll Into View    ${id}

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
    [Documentation]    Android exposes a switch's state as checked, iOS as value 1/0. A radio is not
    ...                the same: iOS has no radio trait and reports a spoken value instead, which is
    ...                why Theme Should Be Selected matches on different text. Keep the two apart -
    ...                they read the same accessibilityState and report it differently.
    [Arguments]    ${locator}    ${on}
    ${id}=    Bare Test Id    ${locator}
    IF    ${on}
        RETURN    xpath=//*[(@content-desc='${id}' or @resource-id='${id}' or @name='${id}') and (@checked='true' or @value='1')]
    END
    RETURN    xpath=//*[(@content-desc='${id}' or @resource-id='${id}' or @name='${id}') and (@checked='false' or @value='0')]

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
    [Documentation]    Reaching the screen is the app's part; filling it is the backend's.
    ...                A currency list that never answers is an environment gap, so the cases that
    ...                need a currency to pick skip rather than report an app regression - the same
    ...                line the staking list already draws. The screen itself is still asserted, so
    ...                a broken navigation still fails.
    Open From Settings    ${SETTINGS_ITEM_CURRENCY}    ${CURRENCY_SEARCH_INPUT}
    ${loaded}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${CURRENCY_ITEM_ALGO}    timeout=30s
    IF    not ${loaded}    Capture Page Screenshot
    Skip If    not ${loaded}
    ...    Currency list did not load in 30s: the Pera backend's /v1/currencies/ did not answer (network or backend), so there is nothing to pick.

Search Currency
    [Arguments]    ${term}
    Tap    ${CURRENCY_SEARCH_INPUT}
    Input Text    ${CURRENCY_SEARCH_INPUT}    ${term}
    # With the keyboard up, the first tap on a result only dismisses the keyboard.
    Dismiss Keyboard

Select Currency
    [Arguments]    ${code}
    Search Currency    ${code}
    Tap    xpath=//*[@resource-id='settings_currency_item_${{ $code.lower() }}' or @name='settings_currency_item_${{ $code.lower() }}' or @content-desc='settings_currency_item_${{ $code.lower() }}']
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

Theme Should Be Selected
    [Documentation]    PWRadioButton sets accessibilityState={{ checked: isSelected }} with
    ...                accessibilityRole='radio'. Android reports that as checked='true'. iOS does not
    ...                carry it as a trait at all: RCTViewComponentView builds a spoken value instead,
    ...                so the element reads 'radio button, checked' or 'radio button, unchecked'. The
    ...                '1' that the switch helpers match is the Switch trait only, and plain
    ...                contains(@value,'checked') is true of 'unchecked' as well - hence both halves.
    ...                This used to look for @selected, which nothing ever sets, so the check could
    ...                not pass and the cases around it proved only that a radio existed.
    [Arguments]    ${theme}
    Wait Until Page Contains Element
    ...    xpath=//*[(@content-desc='settings_theme_${theme}_radio' or @resource-id='settings_theme_${theme}_radio' or @name='settings_theme_${theme}_radio') and (@checked='true' or (contains(@value,'checked') and not(contains(@value,'unchecked'))))]
    ...    timeout=10s
