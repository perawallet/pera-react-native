*** Settings ***
Documentation       What must survive a cold start. Relaunch Pera is the restart: it also clears the
...                 prompts a launch brings, so the case asserts on a usable app.
Resource            settings.resource
Resource            accounts.resource


*** Variables ***
# The name a rename case found, for its teardown to put back.
${ORIGINAL_ACCOUNT_NAME}            ${EMPTY}
${SETTINGS_DELETE_ALL_CONFIRM}      xpath=//*[@resource-id='settings_delete_all_confirm_button' or @name='settings_delete_all_confirm_button' or @content-desc='settings_delete_all_confirm_button']
${SETTINGS_DELETE_ALL_SUCCESS}      xpath=//*[@resource-id='settings_delete_all_success_bottom_sheet' or @name='settings_delete_all_success_bottom_sheet']


*** Keywords ***
Select Theme
    [Arguments]    ${theme}
    Open Settings
    Open Theme Settings
    Tap    xpath=//*[@resource-id='settings_theme_${theme}_radio' or @name='settings_theme_${theme}_radio' or @content-desc='settings_theme_${theme}_radio']

Restore System Theme
    Capture Failure Screenshot
    Select Theme    system

Restore Usd
    Capture Failure Screenshot
    Open Settings
    Open Currency Settings
    Select Currency    USD

Rename Selected Account
    [Documentation]    Returns the name it replaced.
    [Arguments]    ${name}
    Go Home
    Open Account Option    ${OPTION_RENAME}
    Wait Until Settled    ${RENAME_SAVE_BUTTON}
    ${previous}=    Get Text    ${RENAME_INPUT}
    Clear Text    ${RENAME_INPUT}
    Input Text    ${RENAME_INPUT}    ${name}
    Tap    ${RENAME_SAVE_BUTTON}
    Wait Until Page Does Not Contain Element    ${RENAME_INPUT}    timeout=10s
    RETURN    ${previous}

Restore Account Name
    Capture Failure Screenshot
    IF    $ORIGINAL_ACCOUNT_NAME    Rename Selected Account    ${ORIGINAL_ACCOUNT_NAME}

Ensure Wallet After Test
    [Documentation]    A removal case that fails between removing and recreating would leave every
    ...                later case on onboarding, where fixtures do nothing.
    Capture Failure Screenshot
    ${onboarding}=    Run Keyword And Return Status    Page Should Contain Element    ${CREATE_WALLET_BUTTON}
    IF    ${onboarding}
        Create Wallet
        Wait Clear Of Startup Prompts
    END
