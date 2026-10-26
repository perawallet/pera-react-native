*** Settings ***
Documentation       Shared session, wallet and fixture keywords. The platform adapter is chosen by
...                 PLATFORM (android or ios) and supplies Open Pera (attached, past any dev-client intro), Restart Pera, Open Deeplink,
...                 Close Sheet and ${MENU_TAB}.
Library             AppiumLibrary    run_on_failure=Nothing
Library             libraries/NavTrace.py
Resource            platforms/${PLATFORM}.resource


*** Variables ***
${CREATE_WALLET_BUTTON}         xpath=//*[@resource-id='onboarding_create_wallet_button' or @name='onboarding_create_wallet_button' or @content-desc='onboarding_create_wallet_button']
${TERMS_AGREE_BUTTON}           xpath=//*[@resource-id='terms_agree_button' or @name='terms_agree_button' or @content-desc='terms_agree_button']
${ACCOUNT_NAME_INPUT}           xpath=//*[@resource-id='name_account_name_input' or @name='name_account_name_input' or @content-desc='name_account_name_input']
${ACCOUNT_FINISH_BUTTON}        xpath=//*[@resource-id='name_account_finish_button' or @name='name_account_finish_button' or @content-desc='name_account_finish_button']
${PIN_PROMPT_DONT_ASK}          xpath=//*[@resource-id='pin_security_prompt_dont_ask_button' or @name='pin_security_prompt_dont_ask_button' or @content-desc='pin_security_prompt_dont_ask_button']
${BANNERS_MODAL_CLOSE}          xpath=//*[@resource-id='banners_carousel_modal_close' or @name='banners_carousel_modal_close' or @content-desc='banners_carousel_modal_close']
${BANNER_PROMPT_CLOSE}          xpath=//*[@resource-id='banner_prompt_close' or @name='banner_prompt_close' or @content-desc='banner_prompt_close']
${ANALYTICS_CONSENT_DECLINE}    xpath=//*[@resource-id='analytics_consent_prompt_decline_button' or @name='analytics_consent_prompt_decline_button' or @content-desc='analytics_consent_prompt_decline_button']
${STARTUP_PROMPT_ANY}           xpath=//*[@content-desc='pin_security_prompt_dont_ask_button' or @resource-id='pin_security_prompt_dont_ask_button' or @name='pin_security_prompt_dont_ask_button' or @content-desc='banners_carousel_modal_close' or @resource-id='banners_carousel_modal_close' or @name='banners_carousel_modal_close' or @content-desc='banner_prompt_close' or @resource-id='banner_prompt_close' or @name='banner_prompt_close' or @content-desc='analytics_consent_prompt_decline_button' or @resource-id='analytics_consent_prompt_decline_button' or @name='analytics_consent_prompt_decline_button']
${NAVIGATION_BACK_BUTTON}       xpath=//*[@resource-id='navigation_back_button' or @name='navigation_back_button' or @content-desc='navigation_back_button']
${MENU_SETTINGS_BUTTON}         xpath=//*[@resource-id='menu_settings_button' or @name='menu_settings_button' or @content-desc='menu_settings_button']
${SETTINGS_SCREEN}              xpath=//*[@resource-id='settings_screen' or @name='settings_screen']
${SETTINGS_SECURITY_ITEM}       xpath=//*[@resource-id='settings_item_security' or @name='settings_item_security' or @content-desc='settings_item_security']
${DELETE_ALL_SUCCESS_SHEET}     xpath=//*[@resource-id='settings_delete_all_success_bottom_sheet' or @name='settings_delete_all_success_bottom_sheet']
# Screens that can show a recovery phrase: the import word fields, the backup grid and quiz.
${SECRET_SCREEN}                xpath=//*[starts-with(@name,'import_account_word_input_') or starts-with(@content-desc,'import_account_word_input_') or starts-with(@resource-id,'import_account_word_input_') or starts-with(@name,'passphrase_word_') or starts-with(@resource-id,'passphrase_word_') or starts-with(@name,'backup_verification_item_') or starts-with(@content-desc,'backup_verification_item_') or starts-with(@resource-id,'backup_verification_item_')]
# Onboarding (no wallet) or Home (wallet); either means the app has rendered.
${FIRST_SCREEN}                 xpath=//*[@name='onboarding_create_wallet_button' or @content-desc='onboarding_create_wallet_button' or @resource-id='onboarding_create_wallet_button' or @name='tab_menu_button' or @content-desc='Menu' or @resource-id='tab_menu_button' or @name='numpad_key_1' or @content-desc='numpad_key_1' or @resource-id='numpad_key_1']
${PIN_PAD_KEY}                  xpath=//*[@resource-id='numpad_key_1' or @name='numpad_key_1' or @content-desc='numpad_key_1']
${ACCOUNT_DRAWER_SLIVER}        xpath=//*[@resource-id='pw_drawer_gesture_surface' or @name='pw_drawer_gesture_surface']
${SHEET_BACKDROP}                xpath=//*[@content-desc='Bottom sheet backdrop' or @name='Bottom sheet backdrop']
# The only PINs any suite sets (security.robot). A run that dies with one set leaves the next cold
# start on the lock screen, so every relaunch unlocks with them rather than failing there.
@{E2E_PINS}                     123456    445566
${FIXTURE_URL}                  perawallet://app/dev/e2e-fixture
${FIXTURE_SETTLE}               1.5s


*** Keywords ***
Start Pera With Wallet
    [Documentation]    Fixtures need an account to exist, and creating one stays a UI journey so the
    ...                fixture hook never handles key material. Reuses the wallet when one is there.
    Open Pera
    # A relaunch shows the app's real start screen rather than whatever a previous run left up.
    Relaunch Pera

    Go Home

Relaunch Pera
    [Documentation]    Cold-starts the app and clears whatever stands between launch and a usable
    ...                first screen: dev-client intro, updated terms, a new wallet when there is none,
    ...                and the prompts that arrive just after Home.
    Restart Pera
    Wait Until Page Contains Element    ${FIRST_SCREEN}    timeout=30s
    Dismiss Dev Client Intro
    Unlock With Known Pins
    # An existing wallet meets an "Updated Terms" screen at launch when the terms version moved.
    Tap If Present    ${TERMS_AGREE_BUTTON}
    ${onboarding}=    Run Keyword And Return Status    Page Should Contain Element    ${CREATE_WALLET_BUTTON}
    IF    ${onboarding}    Create Wallet
    Wait Clear Of Startup Prompts

Unlock With Known Pins
    FOR    ${pin}    IN    @{E2E_PINS}
        ${locked}=    Run Keyword And Return Status    Page Should Contain Element    ${PIN_PAD_KEY}
        IF    not ${locked}    RETURN
        # The pad keeps digits across attempts; one lost or doubled tap would shift every PIN after it.
        FOR    ${_}    IN RANGE    6
            Click Element    xpath=//*[@resource-id='numpad_key_delete' or @name='numpad_key_delete' or @content-desc='numpad_key_delete']
        END
        FOR    ${digit}    IN    @{{ list($pin) }}
            Tap    xpath=//*[@resource-id='numpad_key_${digit}' or @name='numpad_key_${digit}' or @content-desc='numpad_key_${digit}']
        END
        # A Logging in overlay hides the pad while the PIN is checked; a wrong PIN brings the pad
        # back, a right one lands on Home. Then the loop tries the next PIN or returns.
        Run Keyword And Return Status    Wait Until Page Does Not Contain Element    ${PIN_PAD_KEY}    timeout=10s
        Wait Until Page Contains Element    ${FIRST_SCREEN}    timeout=30s
    END

Go Home
    [Documentation]    Home with a fresh back stack and no sheet open, data untouched. The usual
    ...                per-test anchor for suites that do not need their own fixture.
    Load Fixture    home
    # On iOS the reset leaves the account drawer open over Home; tapping its content sliver closes it.
    Tap If Present    ${ACCOUNT_DRAWER_SLIVER}
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s
    # The reset only starts the last test's sheet sliding out; a sheet requested before it has
    # gone is dropped with it.
    ${closed}=    Run Keyword And Return Status
    ...    Wait Until Page Does Not Contain Element    ${SHEET_BACKDROP}    timeout=10s
    # A build without the fixture hook (the staging build the smoke gate runs) ignores the link and
    # leaves the sheet up; a relaunch is the only other way back to a bare Home.
    IF    not ${closed}
        Restart Pera
        Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s
        Wait Clear Of Startup Prompts
    END

Create Wallet
    # Onboarding slides in after Remove All; a tap while it moves misses the button.
    Wait Until Settled    ${CREATE_WALLET_BUTTON}
    Tap    ${CREATE_WALLET_BUTTON}
    # The terms sheet slides up; I Agree tapped mid-slide lands on the backdrop and closes it.
    ${terms}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${TERMS_AGREE_BUTTON}    timeout=30s
    IF    ${terms}
        Wait Until Settled    ${TERMS_AGREE_BUTTON}
        Click Element    ${TERMS_AGREE_BUTTON}
    END
    Wait Until Page Contains Element    ${ACCOUNT_NAME_INPUT}    timeout=30s
    # The field is prefilled with the truncated address; without clearing, the name becomes both.
    Clear Text    ${ACCOUNT_NAME_INPUT}
    Input Text    ${ACCOUNT_NAME_INPUT}    E2E
    # The field takes focus and the keyboard lifts Finish while it settles.
    Wait Until Settled    ${ACCOUNT_FINISH_BUTTON}
    Tap    ${ACCOUNT_FINISH_BUTTON}
    # The account is written asynchronously after Finish; a fixture fired before Home exists
    # interrupts it and leaves contacts with no wallet, which breaks every later navigation.
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=60s

Wait Clear Of Startup Prompts
    [Documentation]    The PIN, analytics-consent and banner prompts arrive about 3s after Home and swallow taps.
    ...                A backend with announcements (staging) also raises the banner prompt sheet.
    ...                Dismiss them until none has shown for longer than that delay.
    ...                One probe covers them all, so a quiet round costs one driver call.
    ${quiet_since}=    Evaluate    time.time()    modules=time
    FOR    ${i}    IN RANGE    90
        ${any}=    Run Keyword And Return Status    Page Should Contain Element    ${STARTUP_PROMPT_ANY}
        IF    ${any}
            Tap If Present    ${PIN_PROMPT_DONT_ASK}
            Tap If Present    ${BANNERS_MODAL_CLOSE}
            Tap If Present    ${BANNER_PROMPT_CLOSE}
            Tap If Present    ${ANALYTICS_CONSENT_DECLINE}
            ${quiet_since}=    Evaluate    time.time()    modules=time
        ELSE IF    ${{time.time() - $quiet_since}} > 4
            RETURN
        END
        Sleep    0.5s
    END
    Fail    Startup prompts kept coming back.

Load Fixture
    [Documentation]    Requires a build bundled with E2E_FIXTURES=1; any other build ignores the link.
    [Arguments]    ${name}
    # A snapshot from an earlier load can land late; drain first so only this load's line counts.
    Drain Nav Log
    # The app drops a link identical to one handled under 1.5s ago (useDeeplinkListener), as when a
    # suite setup's Go Home is followed by the first test's; a unique parameter keeps every load.
    Open Deeplink    ${FIXTURE_URL}?name=${name}&run=${{time.time_ns()}}
    # The driver returns before the app has handled the link, so an anchor checked right away can
    # match the previous test's screen. The tracer logs a snapshot once the reset has settled; wait
    # on that, and fall back to a fixed wait only when the device log cannot be read.
    ${applied}=    Wait For Nav Snapshot    fixture:${name}
    IF    not ${applied}    Sleep    ${FIXTURE_SETTLE}

Tap
    [Documentation]    Retries only a stale or briefly missing element (a re-render between the wait and
    ...                the click): that tap never landed. Any other error may follow a tap that did
    ...                land, and retrying it could toggle a switch twice.
    [Arguments]    ${locator}
    FOR    ${attempt}    IN RANGE    3
        TRY
            Click Element    ${locator}
            RETURN
        EXCEPT    StaleElementReferenceException*    type=GLOB    AS    ${error}
            Sleep    0.2s
        EXCEPT    *did not match any elements*    type=GLOB    AS    ${error}
            Wait Until Page Contains Element    ${locator}    timeout=5s
        END
    END
    Fail    ${locator} kept going stale: ${error}

Capture Failure Screenshot
    [Documentation]    Test Teardown for every suite. Skips the screenshot while a recovery phrase can
    ...                be on screen: Android blacks those screens out, but iOS does not.
    IF    '${TEST STATUS}' != 'FAIL'    RETURN
    ${secret}=    Run Keyword And Return Status    Page Should Contain Element    ${SECRET_SCREEN}
    IF    ${secret}
        Log    Screenshot skipped: a recovery phrase may be on screen.    level=WARN
    ELSE
        Run Keyword And Ignore Error    Capture Page Screenshot
    END

Reset To Fresh Wallet
    [Documentation]    Suite Teardown for suites that import, add or remove accounts: removes every
    ...                account and creates one new unfunded wallet, so later suites start from the
    ...                state Start Pera With Wallet assumes instead of whatever this suite left.
    # A teardown runs every step even after one fails, so from a wrong screen each later step
    # would spend its full wait, minutes per failed suite. Stop at the first failure instead.
    [Tags]    robot:recursive-stop-on-failure
    # Nothing to reset when the suite never reached the app. Only a suite teardown has the message;
    # tests call this too.
    ${suite_message}=    Get Variable Value    \${SUITE MESSAGE}    ${EMPTY}
    IF    'Suite setup failed' in $suite_message    RETURN
    # A case that failed after removing every account leaves onboarding up, where fixtures do nothing.
    ${onboarding}=    Run Keyword And Return Status    Page Should Contain Element    ${CREATE_WALLET_BUTTON}
    IF    not ${onboarding}    Remove All Accounts
    Create Wallet
    Wait Clear Of Startup Prompts

Open Settings
    [Documentation]    Menu > Settings from any screen of a wallet, with the list settled.
    Go Home
    Tap    ${MENU_TAB}
    # A wallet the suite created just before can still raise its startup prompts, which swallow the tap.
    ${menu}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=5s
    IF    not ${menu}
        Wait Clear Of Startup Prompts
        Tap    ${MENU_TAB}
        Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=15s
    END
    Wait Until Settled    ${MENU_SETTINGS_BUTTON}
    # The gear tap is sometimes dropped: under a toast the suite raised last, and on iOS right after
    # Go Home remounted the tab shell (Menu focused, no Settings mount in the nav trace). Tap again
    # only while Settings is not up, so it is never pushed twice.
    FOR    ${_}    IN RANGE    3
        Tap    ${MENU_SETTINGS_BUTTON}
        ${settings}=    Run Keyword And Return Status
        ...    Wait Until Page Contains Element    ${SETTINGS_SCREEN}    timeout=5s
        IF    ${settings}    BREAK
    END
    # Settings slides in; a row tapped mid-slide is missed.
    Wait Until Settled    ${SETTINGS_SECURITY_ITEM}

Remove All Accounts
    [Documentation]    Settings > Remove all accounts, through to a settled onboarding screen.
    Open Settings
    Scroll Into View    settings_remove_all_accounts_button
    Tap    xpath=//*[@resource-id='settings_remove_all_accounts_button' or @name='settings_remove_all_accounts_button' or @content-desc='settings_remove_all_accounts_button']
    Wait Until Settled    xpath=//*[@resource-id='settings_delete_all_confirm_button' or @name='settings_delete_all_confirm_button' or @content-desc='settings_delete_all_confirm_button']
    Tap    xpath=//*[@resource-id='settings_delete_all_confirm_button' or @name='settings_delete_all_confirm_button' or @content-desc='settings_delete_all_confirm_button']
    # The app routes back to onboarding only once the success sheet is closed.
    Wait Until Page Contains Element    ${DELETE_ALL_SUCCESS_SHEET}    timeout=30s
    # A backdrop tap while the sheet still slides up is lost, and onboarding under it then
    # takes no taps.
    Wait Until Settled    ${DELETE_ALL_SUCCESS_SHEET}
    # Its Close button has no testID (ConfirmActionContent gets no confirmTestID); a backdrop tap
    # (the adapters' Close Sheet) closes it on both platforms.
    Close Sheet
    # Onboarding is already in the tree under the closing sheet; a tap before it is gone is lost.
    Wait Until Page Does Not Contain Element    ${DELETE_ALL_SUCCESS_SHEET}    timeout=15s
    Wait Until Settled    ${CREATE_WALLET_BUTTON}

Tap Upper Half
    [Documentation]    For rows a system bar can cover: a sheet that ignores the bottom inset puts its
    ...                last row under Android's three-button bar, where a centre tap lands on the bar.
    [Arguments]    ${locator}
    ${location}=    Get Element Location    ${locator}
    ${size}=    Get Element Size    ${locator}
    ${point}=    Evaluate
    ...    (int($location['x'] + $size['width'] / 2), int($location['y'] + $size['height'] / 4))
    AppiumLibrary.Tap With Positions    100ms    ${point}

Tap Back
    Tap    ${NAVIGATION_BACK_BUTTON}

Wait Until Settled
    [Documentation]    Waits for an element to stop moving. A sheet's buttons exist while it still
    ...                slides in, and a tap at their moving position lands on the backdrop and closes it.
    [Arguments]    ${locator}
    Wait Until Page Contains Element    ${locator}    timeout=15s
    ${last}=    Get Element Location    ${locator}
    FOR    ${i}    IN RANGE    30
        Sleep    0.15s
        ${now}=    Get Element Location    ${locator}
        IF    $now == $last    RETURN
        ${last}=    Set Variable    ${now}
    END

Tap If Present
    [Arguments]    ${locator}
    ${present}=    Run Keyword And Return Status    Page Should Contain Element    ${locator}
    # Something it dismisses (a drawer, a prompt) can leave on its own between the check and the
    # tap; gone is the outcome either way, so a vanished element is not an error.
    IF    ${present}
        ${tapped}=    Run Keyword And Return Status    Click Element    ${locator}
        IF    not ${tapped}
            ${present}=    Run Keyword And Return Status    Page Should Contain Element    ${locator}
            IF    ${present}    Click Element    ${locator}
        END
    END
    RETURN    ${present}

Tap If Shown
    [Arguments]    ${locator}    ${timeout}
    ${shown}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${locator}    timeout=${timeout}
    IF    ${shown}    Click Element    ${locator}

Close Pera
    Close All Applications

Scroll Until Tappable
    [Documentation]    Swipes up until the element's centre, where a tap lands, is inside the window.
    ...                A row below the fold can be in the tree and report itself displayed, and
    ...                tapping it there lands on whatever is at its off-screen coordinates instead.
    [Arguments]    ${locator}
    ${height}=    Get Window Height
    FOR    ${i}    IN RANGE    6
        ${present}=    Run Keyword And Return Status    Page Should Contain Element    ${locator}
        IF    ${present}
            ${location}=    Get Element Location    ${locator}
            ${size}=    Get Element Size    ${locator}
            IF    ${location}[y] + ${size}[height] / 2 < ${height} * 0.95    RETURN
        END
        Swipe By Percent    50    75    50    35    duration=600ms
    END
    Fail    ${locator} never scrolled into view.

Displayed Value
    [Documentation]    Text of an element whose testID came from getTestProps. On iOS that helper sets
    ...                the accessibility label to the testID, which hides the rendered value; fail on
    ...                that rather than assert against the id.
    [Arguments]    ${test_id}
    ${text}=    Get Text    xpath=//*[@resource-id='${test_id}' or @name='${test_id}' or @content-desc='${test_id}']
    Skip If    $text.strip() == $test_id
    ...    App gap: PWText passes its testID through getTestProps (apps/mobile/src/components/core/PWText/PWText.tsx), which makes it the iOS accessibility label, so ${test_id}'s value cannot be read.
    RETURN    ${text}

Number In
    [Documentation]    The first number a displayed value contains, as a float.
    [Arguments]    ${text}
    ${match}=    Evaluate    re.search(r'[-+]?[0-9][0-9,]*(?:[.][0-9]+)?', $text)    modules=re
    Should Not Be Equal    ${{ None }}    ${match}
    ...    msg=No number in "${text}", so there is nothing to check.
    RETURN    ${{ float($match.group(0).replace(',', '')) }}

Displayed Number Should Be At Least
    [Documentation]    Reads a value off the screen and checks it, rather than checking that a
    ...                field exists. A field that renders but shows the wrong number passes every
    ...                presence check there is.
    [Arguments]    ${test_id}    ${minimum}=${0}
    ${text}=    Displayed Value    ${test_id}
    ${value}=    Number In    ${text}
    Should Be True    ${value} >= ${minimum}
    ...    msg=${test_id} shows ${value} ("${text}"), which is below ${minimum}.
    RETURN    ${value}

Text Under
    [Documentation]    The text a container renders, gathered from its child text nodes. Reading a
    ...                container directly gives back an empty string on Android.
    [Arguments]    ${locator}
    # The locator carries its strategy prefix; the descendant step has to go on the xpath itself.
    ${path}=    Set Variable    ${{ $locator.split('=', 1)[1] if $locator.startswith('xpath=') else $locator }}
    ${found}    ${nodes}=    Run Keyword And Ignore Error    Get Webelements
    ...    xpath=(${path})//*[string-length(@text) > 0 or string-length(@label) > 0 or string-length(@name) > 0]
    IF    '${found}' != 'PASS'    RETURN    ${EMPTY}
    @{parts}=    Create List
    FOR    ${node}    IN    @{nodes}
        ${text}=    Get Text    ${node}
        ${seen}=    Evaluate    $text in $parts
        IF    $text and not ${seen}    Append To List    ${parts}    ${text}
    END
    RETURN    ${{ ' '.join($parts) }}

