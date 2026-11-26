// Normal UI paths shared by the product tests.
export async function switchPresentation(page) {
  const tools = page.locator("body.geo-experience.present #geo-controls");
  if (await tools.count()) {
    if ((await tools.getAttribute("aria-expanded")) === "false")
      await tools.click();
  }
  await page.click("#present");
}
export async function chooseRelated(page) {
  const select = page.locator("#geo-preset");
  await page.waitForFunction(
    () => !!document.querySelector("#geo-preset").dataset.related,
  );
  const value = await select.getAttribute("data-related");
  await select.selectOption(value.replace(/^nyos:/, ""));
}
export async function compareLake(page, index) {
  await page.selectOption("#geo-preset", "compare:" + index);
}
