*** Settings ***
Documentation       Pera Card: the intro offered from Add Account, the sign-in form and the first
...                 sign-up step. Nothing past them: an account needs KYC and a card backend session.
Resource            accounts.resource


*** Variables ***
${ADD_ACCOUNT_PERA_CARD_BUTTON}     tid=add_account_pera_card_button
${CARD_INTRO_CREATE_BUTTON}         tid=pera_card_intro_create_button
${CARD_INTRO_LOGIN_BUTTON}          tid=pera_card_intro_login_button
${CARD_INTRO_LEARN_MORE}            tid=pera_card_intro_learn_more
# Screen containers carry a bare testID: resource-id on Android, name on iOS.
${CARD_SIGN_IN_SCREEN}              tid=card-sign-in
${CARD_SIGN_IN_EMAIL_INPUT}         tid=card-sign-in-email-input
${CARD_SIGN_IN_PASSWORD_INPUT}      tid=card-sign-in-password-input
${CARD_SIGN_IN_SUBMIT}              tid=card-sign-in-submit
${CARD_SIGN_IN_FORGOT_PASSWORD}     tid=card-sign-in-forgot-password
${CARD_FORGOT_PASSWORD_SCREEN}      tid=card-forgot-password
${CARD_FORGOT_PASSWORD_EMAIL}       tid=card-forgot-password-email-input
${CARD_FORGOT_PASSWORD_SUBMIT}      tid=card-forgot-password-submit
${CARD_ONBOARDING_EMAIL_INPUT}      tid=card-onboarding-email-input
${CARD_ONBOARDING_COUNTRY_FIELD}    tid=card-onboarding-country-field


*** Keywords ***
Open Pera Card Intro
    [Documentation]    Add Account offers Pera Card only while the feature is on for the build and
    ...                no card session exists, so a build without it skips here.
    Open Account Switcher
    Tap    ${ACCOUNT_MENU_ADD_BUTTON}
    Wait Until Page Contains Element    ${ADD_ACCOUNT_IMPORT_BUTTON}    timeout=20s
    ${offered}=    Run Keyword And Return Status    Scroll Until Tappable    ${ADD_ACCOUNT_PERA_CARD_BUTTON}
    Skip If    not ${offered}    Add Account offers no Pera Card entry: the feature is off for this build.
    Tap    ${ADD_ACCOUNT_PERA_CARD_BUTTON}
    Wait Until Settled    ${CARD_INTRO_CREATE_BUTTON}

Open Card Sign In
    Open Pera Card Intro
    Tap    ${CARD_INTRO_LOGIN_BUTTON}
    Wait Until Page Contains Element    ${CARD_SIGN_IN_SCREEN}    timeout=20s
    Wait Until Settled    ${CARD_SIGN_IN_SUBMIT}
