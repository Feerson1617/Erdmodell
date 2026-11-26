type Route = { source: HTMLSelectElement; id: string; title: string; group: string };
const earth = "Die Erde", plates = "Kontinentaldrift und Plattentektonik";
const quake = "Erdbeben", volcano = "Vulkanismus", lakes = "Maare und vulkanische Seen", risks = "Naturrisiken und Schutz";
const examples: Record<string, string[]> = {
  [earth]: ["country-de","sylt","denmark","alps","schleswig","local-hooge","local-helgoland"],
  [plates]: ["tonga","peru","island","himalaya"], [quake]: ["san","himalaya","japan"],
  [volcano]: ["maunaloa","zaozan","hawaii","island","tonga","eifel"], [lakes]: ["eifel","ulmen","wittlich","country-cm"],
  [risks]: ["japan","san"],
};
function groupFor(id: string, original: string) {
  if (["globe","inside","layers","place"].includes(id)) return earth;
  if (original === "Vulkanismus" || ["volcano","seismic-vt"].includes(id)) return volcano;
  if (original === "Maare und Seen" || id.startsWith("nyos")) return lakes;
  if (original === "Erdbeben" || ["events","quake"].includes(id)) return quake;
  return ["sea","risk"].includes(id) ? risks : plates;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, value: string) {
  const node = document.createElement(tag); node.textContent = value; return node;
}
function sheet(title: string) {
  const dialog = document.querySelector<HTMLDialogElement>("#dialog")!;
  const body = document.querySelector<HTMLElement>("#content")!;
  const heading = element("h2", title); heading.id = "dialogTitle";
  body.replaceChildren(heading); if (!dialog.open) dialog.showModal();
  return {dialog, body};
}
export function termInfo(name: string, detail: string) {
  const {body} = sheet(name);
  body.append(element("p", detail));
}
export function explorationMenu(host: HTMLElement, topics: HTMLSelectElement, places: HTMLSelectElement, help: () => string[]) {
  const open = element("button", "Was lernen wir heute?"); open.id = "geo-explore";
  const hint = element("button","?"); hint.id = "geo-help"; hint.setAttribute("aria-label","Hilfe zur aktuellen Ansicht");
  topics.hidden = places.hidden = true;
  host.append(open,hint);
  hint.onclick = () => {
    const {body} = sheet("Hilfe zur Ansicht");
    const sections = ["Was zeigt diese Ansicht?", "Was kann ich hier machen?", "Welche weiteren Darstellungen gibt es?"];
    help().forEach((value,i) => {if(value) body.append(element("h3",sections[i]),element("p",value));});
  };
  const routes: Route[] = [topics,places].flatMap(source => Array.from(source.options).filter(o=>o.value).map(o=>({
    source, id:o.value, title:o.text, group:source===places ? "Orte" : groupFor(o.value,(o.parentElement as HTMLOptGroupElement).label)
  })));
  open.onclick = () => {
    const {dialog,body} = sheet(open.textContent!);
    const search = document.createElement("input");
    search.type="search";search.placeholder="Thema oder Ort suchen";search.setAttribute("aria-label",search.placeholder);
    const categories=element("div",""), results=element("div","");
    categories.className="geo-categories";results.className="geo-results";
    let group="";
    const render=()=>{
      const query=search.value.trim().toLocaleLowerCase("de");
      const entries=routes.filter(r=>query ? r.title.toLocaleLowerCase("de").includes(query) :
        r.group===group || (r.source===places && examples[group]?.includes(r.id)));
      results.replaceChildren();
      for(const r of entries){
        const b=element("button",r.title);
        b.dataset.target=r.source.id+"/"+r.id;
        b.onclick=()=>{dialog.close(); r.source.value=r.id; r.source.dispatchEvent(new Event("change"));};
        results.append(b);
      }
      if(query && !entries.length) results.append(element("p","Kein passendes Thema oder Ort gefunden."));
      for(const button of categories.querySelectorAll("button")) button.setAttribute("aria-pressed",String(!query && button.textContent===group));
    };
    for(const label of [earth,plates,quake,volcano,lakes,risks,"Orte"]){
      const b=element("button",label);b.onclick=()=>{group=label; search.value="";render();};categories.append(b);
    }
    search.oninput=render;body.append(search,categories,results);search.focus();
  };
}
