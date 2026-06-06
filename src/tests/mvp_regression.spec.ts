import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string) {
    return readFileSync(join(root, path), "utf8");
}

test.describe("Phase 14 MVP regression", () => {
    test("OTP shell blocks guest entry", async ({ page }) => {
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
    });

    test("resumable onboarding and waitlist preview stay server-backed", async () => {
        const pageSource = source("src/app/page.tsx");
        const service = source("src/services/supabase.ts");
        const waitlist = source("src/components/WaitlistView.tsx");

        expect(pageSource).toMatch(/loadOnboardingProgress/);
        expect(pageSource).toMatch(/saveOnboardingProgress/);
        expect(pageSource).toMatch(/completedProfile\?\.is_waitlisted\s*\?\s*"waitlist"\s*:\s*"completed"/);
        expect(pageSource).toMatch(/discoverWaitlistPreview\(20,\s*themeMode === "bold" \? "short_term" : "long_term"\)/);
        expect(service).toMatch(/\.rpc\("discover_waitlist_preview"/);
        expect(service).toMatch(/label:\s*"Someone nearby"/);
        expect(waitlist).toMatch(/blur-\[/);
        expect(waitlist).not.toMatch(/peer_id|username|display_name|bio|photos|message action|profile open/i);
    });

    test("admitted discovery feed uses filters, pagination, and first-message action", async () => {
        const pageSource = source("src/app/page.tsx");
        const feed = source("src/components/DiscoveryFeed.tsx");
        const service = source("src/services/supabase.ts");

        expect(pageSource).toMatch(/discoverProfiles\(/);
        expect(pageSource).toMatch(/sendOpeningMessage\(userObj\.peer_id,\s*openingText\)/);
        expect(pageSource).not.toMatch(/getMockProfiles|discover_users|vibelink_mock_chats/);
        expect(feed).toMatch(/minAge/);
        expect(feed).toMatch(/maxAge/);
        expect(feed).toMatch(/city/);
        expect(feed).toMatch(/IntersectionObserver/);
        expect(service).toMatch(/rpc\("discover_profiles"/);
        expect(service).toMatch(/rpc\("send_opening_message"/);
    });

    test("pending reply, expiry, moderation, and meet prompt contracts are wired", async () => {
        const sql = source("supabase_schema_mvp_core.sql");
        const chat = source("src/components/ChatView.tsx");
        const service = source("src/services/supabase.ts");
        const moderation = source("supabase/functions/moderate-message/index.ts");

        expect(sql).toMatch(/status text NOT NULL.*pending.*active.*expired.*locked.*closed/s);
        expect(sql).toMatch(/delivered_at\s*=\s*COALESCE\(delivered_at,\s*now\(\)\)/i);
        expect(sql).toMatch(/pending_expires_at\s*=\s*COALESCE\(pending_expires_at,\s*now\(\)\s*\+\s*interval '3 days'\)/i);
        expect(sql).toMatch(/purge_expired_conversations/);
        expect(sql).toMatch(/MESSAGE_MODERATION_TIMEOUT_MS|message_moderation_queue/i);
        expect(moderation).toMatch(/direct_threats/);
        expect(moderation).toMatch(/sexual_content/);
        expect(moderation).toMatch(/personal_info/);
        expect(moderation).toMatch(/hateful_language/);
        expect(moderation).toMatch(/spam/);
        expect(chat).toMatch(/Yes, let's meet/);
        expect(chat).toMatch(/Keep chatting/);
        expect(service).toMatch(/recordMeetPromptResponse/);
    });

    test("report, block, deletion, export, photo rejection, and banned messaging are covered", async () => {
        const pageSource = source("src/app/page.tsx");
        const settings = source("src/components/SettingsView.tsx");
        const reportSheet = source("src/components/ReportProfileSheet.tsx");
        const blockList = source("src/components/BlockListPanel.tsx");
        const service = source("src/services/supabase.ts");
        const photoFunction = source("supabase/functions/process-photo/index.ts");
        const deletionFinalizer = source("supabase/functions/delete-account-finalizer/index.ts");
        const dataExport = source("supabase/functions/prepare-data-export/index.ts");

        expect(reportSheet).toMatch(/REPORT_REASON_OPTIONS/);
        expect(reportSheet).toMatch(/maxLength=\{REPORT_DETAILS_MAX_LENGTH\}/);
        expect(blockList).toMatch(/unblockUser\(account\.blockedPeerId\)/);
        expect(service).toMatch(/rpc\("block_user"/);
        expect(service).toMatch(/rpc\("submit_report"/);
        expect(settings).toMatch(/requestDataExport/);
        expect(settings).toMatch(/requestSoftAccountDeletion/);
        expect(pageSource).toMatch(/banMessage \|\|/);
        expect(photoFunction).toMatch(/Please use an unedited photo/);
        expect(photoFunction).toMatch(/violates our guidelines/);
        expect(deletionFinalizer).toMatch(/purge_due_account_deletions/);
        expect(dataExport).toMatch(/data_export_requests/);
        expect(dataExport).toMatch(/data-exports/);
    });
});
