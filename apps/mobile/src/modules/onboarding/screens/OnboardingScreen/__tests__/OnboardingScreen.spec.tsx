/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { render, fireEvent, screen } from "@test-utils/render";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnboardingScreen } from "../OnboardingScreen";
import { config } from "@perawallet/wallet-core-config";
import { useOnboardingStore } from "@modules/onboarding/hooks/useOnboardingStore";

// Mock navigation
const mockNavigate = vi.fn();
const mockPush = vi.fn();

vi.mock("@hooks/useAppNavigation", () => ({
	useAppNavigation: () => ({
		navigate: mockNavigate,
		push: mockPush,
	}),
}));

// Mock webview
const mockPushWebView = vi.fn();
vi.mock("@modules/webview", () => ({
	useWebView: () => ({
		pushWebView: mockPushWebView,
	}),
}));

// Mock account creation
const mockCreateHdWalletAccount = vi.fn();
const mockUseHasAccounts = vi.fn(() => false);
vi.mock("@perawallet/wallet-core-accounts", async () => {
	const actual = await vi.importActual<object>(
		"@perawallet/wallet-core-accounts",
	);
	return {
		...actual,
		useCreateAccount: () => ({
			createHdWalletAccount: mockCreateHdWalletAccount,
		}),
		useHasAccounts: () => mockUseHasAccounts(),
	};
});

// Mock deferToNextCycle
vi.mock("@perawallet/wallet-core-shared", async () => {
	const actual = await vi.importActual<object>(
		"@perawallet/wallet-core-shared",
	);
	return {
		...actual,
		deferToNextCycle: (callback: () => Promise<void>) => callback(),
	};
});

// Uses global mock from vitest.setup.ts for @components/core

// Mock react-i18next
vi.mock("react-i18next", async () => {
	const actual = await vi.importActual<object>("react-i18next");
	const React = await import("react");
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
			i18n: {
				changeLanguage: vi.fn(),
				language: "en",
			},
		}),
		Trans: ({
			components,
		}: {
			components: React.ReactElement<React.PropsWithChildren<unknown>>[];
		}) => (
			<>
				By creating a wallet, you agree to Pera Wallet&apos;s
				{React.cloneElement(components[0], {
					children: "Terms and Conditions",
				})}
				and
				{React.cloneElement(components[1], {
					children: "Privacy Policy",
				})}
			</>
		),
	};
});

describe("OnboardingScreen", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUseHasAccounts.mockReturnValue(false);
		useOnboardingStore.getState().reset();
	});

	it("renders correctly", () => {
		render(<OnboardingScreen />);

		expect(screen.getByText("onboarding.main_screen.welcome")).toBeTruthy();
		expect(screen.getByText("onboarding.main_screen.new_to_algo")).toBeTruthy();
		expect(
			screen.getByText("onboarding.main_screen.create_wallet"),
		).toBeTruthy();
		expect(
			screen.getByText("onboarding.main_screen.already_have_account"),
		).toBeTruthy();
		expect(
			screen.getByText("onboarding.main_screen.import_account"),
		).toBeTruthy();
	});

	it("opens terms of service when link is pressed", () => {
		render(<OnboardingScreen />);

		const termsLink = screen.getByText("Terms and Conditions");
		fireEvent.click(termsLink);

		expect(mockPushWebView).toHaveBeenCalledWith({
			url: config.termsOfServiceUrl,
			id: "terms-of-service",
		});
	});

	it("opens privacy policy when link is pressed", () => {
		render(<OnboardingScreen />);

		const privacyLink = screen.getByText("Privacy Policy");
		fireEvent.click(privacyLink);

		expect(mockPushWebView).toHaveBeenCalledWith({
			url: config.privacyPolicyUrl,
			id: "privacy-policy",
		});
	});

	it("navigates to NameAccount when Create Wallet is pressed", async () => {
		const mockAccount = {
			id: "test-id",
			address: "TEST_ADDRESS",
			type: "hdWallet" as const,
			keyPairId: "test-wallet-id",
			hdWalletDetails: {
				account: 0,
				change: 0,
				keyIndex: 0,
				derivationType: 9,
			},
		};

		mockCreateHdWalletAccount.mockResolvedValue(mockAccount);

		render(<OnboardingScreen />);

		const createButton = screen.getByText(
			"onboarding.main_screen.create_wallet",
		);
		fireEvent.click(createButton);

		// Wait for async account creation
		await vi.waitFor(() => {
			expect(mockCreateHdWalletAccount).toHaveBeenCalledWith({
				account: 0,
				keyIndex: 0,
			});
			expect(mockPush).toHaveBeenCalledWith("NameAccount", {
				account: mockAccount,
			});
		});
	});

	it("opens ImportOptionsBottomSheet and navigates to ImportInfo when an option is selected", () => {
		render(<OnboardingScreen />);

		const importButton = screen.getByText(
			"onboarding.main_screen.import_account",
		);
		fireEvent.click(importButton);

		// Bottom sheet should be visible now
		expect(screen.getByText("onboarding.import_options.title")).toBeTruthy();

		// Click one of the options
		const universalWalletOption = screen.getByText(
			"onboarding.import_options.hd_wallet.title",
		);
		fireEvent.click(universalWalletOption);

		expect(mockPush).toHaveBeenCalledWith("ImportInfo", {
			accountType: "hdWallet",
		});
	});

	it("does not render close button during first-time onboarding", () => {
		render(<OnboardingScreen />);

		expect(screen.queryByTestId("icon-cross")).toBeNull();
	});

	describe("when used for adding accounts", () => {
		beforeEach(() => {
			mockUseHasAccounts.mockReturnValue(true);
		});

		it("navigates to NameAccount when Create Wallet is pressed", async () => {
			const mockAccount = {
				id: "test-id",
				address: "TEST_ADDRESS",
				type: "hdWallet" as const,
				keyPairId: "test-wallet-id",
				hdWalletDetails: {
					account: 0,
					change: 0,
					keyIndex: 0,
					derivationType: 9,
				},
			};

			mockCreateHdWalletAccount.mockResolvedValue(mockAccount);

			render(<OnboardingScreen />);

			const createButton = screen.getByText(
				"onboarding.main_screen.create_wallet",
			);
			fireEvent.click(createButton);

			await vi.waitFor(() => {
				expect(mockCreateHdWalletAccount).toHaveBeenCalledWith({
					account: 0,
					keyIndex: 0,
				});
				expect(mockPush).toHaveBeenCalledWith("NameAccount", {
					account: mockAccount,
				});
			});
		});

		it("opens ImportOptionsBottomSheet when Import Account is pressed", () => {
			render(<OnboardingScreen />);

			const importButton = screen.getByText(
				"onboarding.main_screen.import_account",
			);
			fireEvent.click(importButton);

			expect(screen.getByText("onboarding.import_options.title")).toBeTruthy();
		});
	});
});
