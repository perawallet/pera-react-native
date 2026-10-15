*** Settings ***
Documentation       Shared session, wallet and fixture keywords. The platform adapter is chosen by
...                 PLATFORM (android or ios) and supplies Open Pera (attached, past any dev-client intro), Restart Pera, Open Deeplink,
...                 Close Sheet and ${MENU_TAB}.
Library             AppiumLibrary    run_on_failure=Nothing
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
# Onboarding (no wallet) or Home (wallet); either means the app has rendered.
${FIRST_SCREEN}                 xpath=//*[@name='onboarding_create_wallet_button' or @content-desc='onboarding_create_wallet_button' or @name='tab_menu_button' or @content-desc='Menu']
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
    # An existing wallet meets an "Updated Terms" screen at launch when the terms version moved.
    Tap If Present    ${TERMS_AGREE_BUTTON}
    ${onboarding}=    Run Keyword And Return Status    Page Should Contain Element    ${CREATE_WALLET_BUTTON}
    IF    ${onboarding}    Create Wallet
    Wait Clear Of Startup Prompts

Go Home
    [Documentation]    Home with a fresh back stack and no sheet open, data untouched. The usual
    ...                per-test anchor for suites that do not need their own fixture.
    Load Fixture    home
    Wait Until Page Contains Element    ${MENU_TAB}    timeout=30s

Create Wallet
    Tap    ${CREATE_WALLET_BUTTON}
    Tap If Shown    ${TERMS_AGREE_BUTTON}    30s
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
    # The driver returns before the app has handled the link (measured 0.4-1.0s on a simulator),
    # so an anchor checked right away can match the previous test's screen. Upgrade path: have the
    # hook expose a per-load marker the test can wait on.
    Sleep    ${FIXTURE_SETTLE}

Tap
    [Documentation]    A stale element means the tap never landed, so retrying it is safe.
    [Arguments]    ${locator}
    Wait Until Keyword Succeeds    3x    0.2s    Click Element    ${locator}

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
