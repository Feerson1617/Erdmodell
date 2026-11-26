// Exercise the public topic chooser in G6.9 and the native selectors in its predecessor.
export async function selectControl(page, selector, value) {
  if (!["#geo-topic","#geo-place"].includes(selector) || !(await page.locator("#geo-explore").count()))
    return page.selectOption(selector,value);
  const route = await page.locator(selector).evaluate((s,v)=>{
    const o=Array.from(s.options).find(o=>typeof v==="string"?o.value===v:o.text===v.label);
    if (!o) throw Error("Kein Eintrag für "+JSON.stringify(v));
    return {title:o.text,key:s.id+"/"+o.value};
  },value);
  await page.click("#geo-explore");
  await page.getByRole("searchbox").fill(route.title);
  await page.locator("#content [data-target="+JSON.stringify(route.key)+"]").click();
}
