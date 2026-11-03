import { test, expect } from "@playwright/test";

for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`dashboard fits viewport ${width}px and uses no CDN`, async ({ page }) => {
    const thirdParty = new Set<string>();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (!["127.0.0.1", "localhost"].includes(url.hostname)) thirdParty.add(url.hostname);
    });
    await page.setViewportSize({ width, height: 860 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Selamat datang di ruang penerbitan/ })).toBeVisible();
    const dims = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(dims.document).toBeLessThanOrEqual(dims.viewport + 1);
    expect([...thirdParty]).toEqual([]);
    if (width < 761) {
      const menu = page.getByRole("button", { name: "Buka menu" });
      await expect(menu).toBeVisible();
      await menu.click();
      await expect(page.getByRole("navigation", { name: "Menu studio" })).toBeVisible();
      await page.getByRole("button", { name: "Tutup menu" }).click();
      await expect(page.getByRole("navigation", { name: "Menu studio" })).toBeHidden();
    }
  });
}

test("keyboard users can skip to main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Lewati navigasi" })).toBeFocused();
});
