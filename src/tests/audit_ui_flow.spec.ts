import { test, expect } from '@playwright/test';

test('legacy live matching flow is absent from the public shell', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await expect(page.getByRole('button', { name: /join queue/i })).toHaveCount(0);
    await expect(page.locator('[data-testid="remote-video"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="local-video"]')).toHaveCount(0);
    await expect(page.getByText(/live matching|camera and microphone|vibelink/i)).toHaveCount(0);
});
