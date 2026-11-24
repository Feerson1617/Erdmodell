// Select the lesson condition explicitly when testing releases with different defaults.
export async function shellNames(page,visible){
  const toggle=page.locator("#labels");if((await toggle.getAttribute("aria-pressed")==="true")!==visible)await toggle.click();
}
export async function plainAtlas(page){
  const options=page.locator("#plateSettings"),type=page.locator("#boundaryTypes");
  if(!await type.count())return;
  const open=await options.evaluate(el=>el.open);
  if(!open)await options.locator("summary").click();
  await type.uncheck();await page.locator("#plateNames").uncheck();await page.locator("#boundaries").uncheck();
  if(!open&&await options.evaluate(el=>el.open))await options.locator("summary").click();
}
