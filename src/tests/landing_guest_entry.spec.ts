import { expect, test } from "@playwright/test";

test("landing page offers phone OTP entry instead of guest mode", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.evaluate(() => {
        window.localStorage.removeItem("komorembi_guest_id");
        window.localStorage.removeItem("komorembi_profile_cache");
    });
    await page.reload();

    const app = page.getByRole("main");

    await expect(app.getByRole("heading", { name: /log in with phone/i })).toBeVisible();
    await expect(app.getByLabel(/phone number/i)).toBeVisible();
    await expect(app.getByRole("button", { name: /send otp/i })).toBeVisible();
    await expect(app.getByRole("button", { name: /^guest user$/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /start matching/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /join now/i })).toHaveCount(0);
    await expect(page.getByText(/meet new people/i)).toHaveCount(0);
    await expect(page.getByText(/live preview/i)).toHaveCount(0);
});
