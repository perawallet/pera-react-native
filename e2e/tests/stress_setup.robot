*** Settings ***
Documentation       Puts the tier's seeded wallet on the device before a stress run: removes the current
...                 wallet and imports the one STRESS_MNEMONIC recovers. Destructive, so it is its own
...                 suite and carries no `stress` tag. Import the large accounts by hand afterwards
...                 (docs/STRESS_TESTING.md).
Resource            ../resources/stress.resource

Suite Setup         Open Pera
Suite Teardown      Close Pera
Test Teardown       Capture Failure Screenshot
Test Tags           stress-setup    slow


*** Test Cases ***
Import The Tiers Seeded Wallet
    [Tags]    id:stress.setup
    # Read in Python, never substituted into the expression: a substituted phrase would land in
    # the log if the expression failed.
    Skip If    not os.environ.get('STRESS_MNEMONIC')    STRESS_MNEMONIC is not set.
    Import Stress Wallet
    # A phrase seeded for a bigger tier imports that tier's accounts; fail here, not in the numbers.
    Check Imported Account Count
