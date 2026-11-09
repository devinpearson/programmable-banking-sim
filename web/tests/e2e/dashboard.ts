import type { Locator, Page } from '@playwright/test';

// The dashboard's tabs, and the forms that are folded until opened.

export async function showTab(page: Page, tab: 'Banking' | 'Simulate' | 'Sandbox') {
  await page.getByRole('tab', { name: tab }).click();
}

// Open a folded form (Disclosure) in a panel; leaves an open one open.
export async function openForm(panel: Locator, title: string) {
  const summary = panel.locator('summary', { hasText: title });
  const open = await summary.evaluate(s => (s.parentElement as HTMLDetailsElement).open);
  if (!open) await summary.click();
}

// The toolbar's More menu (Clear data, Export, Import).
export async function openMoreMenu(page: Page) {
  await page.locator('summary', { hasText: 'More' }).click();
}
