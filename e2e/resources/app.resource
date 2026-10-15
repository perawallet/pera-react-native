*** Settings ***
Documentation       Shared session, wallet and fixture keywords. The platform adapter is chosen by
...                 PLATFORM (android or ios) and supplies Open Pera (attached, past any dev-client intro), Restart Pera, Open Deeplink,
...                 Close Sheet and ${MENU_TAB}.
Library             AppiumLibrary    run_on_failure=Nothing
Library             libraries/NavTrace.py
Resource            platforms/${PLATFORM}.resource


*** Variables ***
${CREATE_WALLET_BUTTON}         accessibility_id=onboarding_create_wallet_button
${TERMS_AGREE_BUTTON}           accessibility_id=terms_agree_button
${ACCOUNT_NAME_INPUT}           accessibility_id=name_account_name_input
${ACCOUNT_FINISH_BUTTON}        accessibility_id=name_account_finish_button
${PIN_PROMPT_DONT_ASK}          accessibility_id=pin_security_prompt_dont_ask_button
${BANNERS_MODAL_CLOSE}          accessibility_id=banners_carousel_modal_close
${ANALYTICS_CONSENT_DECLINE}    accessibility_id=analytics_consent_prompt_decline_button
${NAVIGATION_BACK_BUTTON}       accessibility_id=navigation_back_button
${MENU_SETTINGS_BUTTON}         accessibility_id=menu_settings_button
# Screens that can show a recovery phrase: the import word fields, the backup grid and quiz.
${SECRET_SCREEN}                xpath=//*[starts-with(@name,'import_account_word_input_') or starts-with(@content-desc,'import_account_word_input_') or starts-with(@name,'passphrase_word_') or starts-with(@resource-id,'passphrase_word_') or starts-with(@name,'backup_verification_item_') or starts-with(@content-desc,'backup_verification_item_') or starts-with(@resource-id,'backup_verification_item_')]
# Onboarding (no wallet) or Home (wallet); either means the app has rendered.
${FIRST_SCREEN}                 xpath=//*[@name='onboarding_create_wallet_button' or @content-desc='onboarding_create_wallet_button' or @name='tab_menu_button' or @content-desc='Menu' or @name='numpad_key_1' or @content-desc='numpad_key_1']
${PIN_PAD_KEY}                  accessibility_id=numpad_key_1
${ACCOUNT_DRAWER_SLIVER}        xpath=//*[@resource-id='pw_drawer_gesture_surface' or @name='pw_drawer_gesture_surface']
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
            Click Element    accessibility_id=numpad_key_delete
        END
        FOR    ${digit}    IN    @{{ list($pin) }}
            Tap    accessibility_id=numpad_key_${digit}
        END
        # A wrong PIN keeps the pad up; fall through to the next one.
        Run Keyword And Return Status    Wait Until Page Does Not Contain Element    ${PIN_PAD_KEY}    timeout=10s
    END

Go Home
    [Documentation]    Home with a fresh back stack and no sheet open, data untouched. The usual
    ...                per-test anchor for suites that do not need their own fixture.
    Load Fixture    home
    # On iOS the reset leaves the account drawer open over Home; tapping its content sliver closes it.
    Tap If Present    ${ACCOUNT_DRAWER_SLIVER}
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s

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
    Input Text    ${ACCOUNT_NAME_INPUT}    E2E
    Tap    ${ACCOUNT_FINISH_BUTTON}
    # The account is written asynchronously after Finish; a fixture fired before Home exists
    # interrupts it and leaves contacts with no wallet, which breaks every later navigation.
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=60s

Wait Clear Of Startup Prompts
    [Documentation]    The PIN, analytics-consent and banner prompts arrive about 3s after Home and swallow taps.
    ...                Dismiss them until none has shown for longer than that delay.
    VAR    ${clear}    ${0}
    FOR    ${i}    IN RANGE    90
        ${pin}=    Tap If Present    ${PIN_PROMPT_DONT_ASK}
        ${banner}=    Tap If Present    ${BANNERS_MODAL_CLOSE}
        ${consent}=    Tap If Present    ${ANALYTICS_CONSENT_DECLINE}
        ${clear}=    Set Variable If    ${pin} or ${banner} or ${consent}    ${0}    ${clear + 1}
        IF    ${clear} >= 8    RETURN
        Sleep    0.5s
    END
    Fail    Startup prompts kept coming back.

Load Fixture
    [Documentation]    Requires a build bundled with E2E_FIXTURES=1; any other build ignores the link.
    [Arguments]    ${name}
    Open Deeplink    ${FIXTURE_URL}?name=${name}
    # The driver returns before the app has handled the link, so an anchor checked right away can
    # match the previous test's screen. The tracer logs a snapshot once the reset has settled; wait
    # on that, and fall back to a fixed wait only when the device log cannot be read.
    ${applied}=    Wait For Nav Snapshot    fixture:${name}
    IF    not ${applied}    Sleep    ${FIXTURE_SETTLE}

Tap
    [Documentation]    Retries only a stale element: that tap never landed. Any other error may follow a
    ...                tap that did land, and retrying it could toggle a switch twice.
    [Arguments]    ${locator}
    FOR    ${attempt}    IN RANGE    3
        TRY
            Click Element    ${locator}
            RETURN
        EXCEPT    StaleElementReferenceException*    type=GLOB    AS    ${error}
            Sleep    0.2s
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
    Go Home
    Tap    ${MENU_TAB}
    Wait Until Page Contains Element    ${MENU_SETTINGS_BUTTON}    timeout=15s
    Tap    ${MENU_SETTINGS_BUTTON}
    Scroll Into View    settings_remove_all_accounts_button
    Tap    accessibility_id=settings_remove_all_accounts_button
    Wait Until Settled    accessibility_id=settings_delete_all_confirm_button
    Tap    accessibility_id=settings_delete_all_confirm_button
    # The app routes back to onboarding only once the success sheet is closed.
    Wait Until Page Contains Element
    ...    xpath=//*[@resource-id='settings_delete_all_success_bottom_sheet' or @name='settings_delete_all_success_bottom_sheet']
    ...    timeout=30s
    Close Sheet
    Wait Until Page Contains Element    ${CREATE_WALLET_BUTTON}    timeout=30s
    Create Wallet
    Wait Clear Of Startup Prompts

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
    IF    ${present}    Click Element    ${locator}
    RETURN    ${present}

Tap If Shown
    [Arguments]    ${locator}    ${timeout}
    ${shown}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${locator}    timeout=${timeout}
    IF    ${shown}    Click Element    ${locator}

Close Pera
    Close All Applications
