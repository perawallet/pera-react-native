*** Settings ***
Documentation       Pera Card on Android and iOS from one suite: the entry from Add Account, the intro,
...                 the sign-in form and the first sign-up step. Fund-free and account-free; every
...                 case skips on a build where the card is not offered.
Resource            ../resources/card.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Close Pera
Test Setup          Go Home
Test Teardown       Capture Failure Screenshot
Test Tags           card


*** Test Cases ***
Add Account Offers The Pera Card Intro
    [Tags]    id:card.intro.from-add-account    p1
    Open Pera Card Intro
    Page Should Contain Element    ${CARD_INTRO_LOGIN_BUTTON}
    Page Should Contain Element    ${CARD_INTRO_LEARN_MORE}

Login Opens The Sign In Form
    [Tags]    id:card.sign-in.form    p1
    Open Card Sign In
    Page Should Contain Element    ${CARD_SIGN_IN_EMAIL_INPUT}
    Page Should Contain Element    ${CARD_SIGN_IN_PASSWORD_INPUT}
    Page Should Contain Element    ${CARD_SIGN_IN_FORGOT_PASSWORD}

Forgot Password Opens The Reset Form
    [Tags]    id:card.sign-in.forgot-password    p2
    Open Card Sign In
    Tap    ${CARD_SIGN_IN_FORGOT_PASSWORD}
    Wait Until Page Contains Element    ${CARD_FORGOT_PASSWORD_SCREEN}    timeout=20s
    Page Should Contain Element    ${CARD_FORGOT_PASSWORD_EMAIL}
    Page Should Contain Element    ${CARD_FORGOT_PASSWORD_SUBMIT}

Create Account Starts At The Email Step
    [Tags]    id:card.sign-up.email-step    p1
    Open Pera Card Intro
    Tap    ${CARD_INTRO_CREATE_BUTTON}
    Wait Until Page Contains Element    ${CARD_ONBOARDING_EMAIL_INPUT}    timeout=20s
    Page Should Contain Element    ${CARD_ONBOARDING_COUNTRY_FIELD}
