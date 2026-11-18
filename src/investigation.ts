// A teacher advances the investigation. Opening or pausing it reveals no further evidence.
const stations = [
  ["NC.NHC", "46,20", "48,37"],
  ["NC.NTO", "47,45", "50,16"],
  ["NC.CPI", "49,52", "54,13"],
];
const titles = ["Vermutung", "Beobachtungen", "Erklärungen vergleichen", "Modell überprüfen", "Grenzen der Schlussfolgerung"];
const prompts = [
  "Was könnte uns verraten, ob das Erdinnere fest oder flüssig ist?",
  "Was wiederholt sich an den drei Stationen? Welche Frage bleibt offen?",
  "Würde ein einzelnes schwaches Signal das weltweite Muster erklären?",
  "Welche Vorhersage macht eure Vermutung? Vergleicht sie mit dem weltweiten Befund.",
  "Welche Aussage trägt euer Beleg? Wofür braucht ihr eine weitere Messung?",
];
const starters = [
  "Ich vermute … Das könnten wir überprüfen, indem wir …",
  "An allen drei Stationen … Die Zeiten unterscheiden sich in …",
  "Wenn nur eine Station gestört wäre, müsste …",
  "Unser Modell sagt voraus, dass … Dazu passt …",
  "Aus diesen Daten erschließen wir … Offen bleibt …",
];
const terms = [
  "Hypothese · eine begründete, überprüfbare Vermutung.",
  "Phase · ein unterscheidbarer Wellenzug. UTC · gemeinsame Weltzeit.",
  "Scherung · benachbarte Materialteile verschieben sich gegeneinander.",
  "Modellannahme · eine angenommene Eigenschaft, aus der eine Vorhersage folgt.",
  "Unsicherheit · mehrere Ursachen können zu einem ähnlichen Einzelsignal führen.",
];
const deeper = [
  "Formuliert vorab eine Beobachtung, die gegen eure Vermutung spräche.",
  "Die Station misst Bodenbewegung über die Zeit. Fachleute bestimmen darin die Einsätze der Phasen. Der Laufweg ist bereits eine Deutung.",
  "Auch Dämpfung, Abstrahlrichtung und Messrauschen beeinflussen die Erkennbarkeit an einer einzelnen Station.",
  "Geschwindigkeitsänderungen krümmen Strahlen. An Grenzen treten Brechung, Reflexion und Wellenumwandlung auf. Umgewandelte Wellen können hinter einer Schattenzone eintreffen.",
  "Für tiefer liegende Grenzen vergleichen Forschende weitere reflektierte und durchgelaufene Phasen, Laufzeiten und Eigenschwingungen. Dichte und Hochdruckexperimente ergänzen die Seismologie.",
];

export class Investigation {
  step = 0;
  active = false;
  private highlighted = false;
  private conclusion = false;
  private help = new Set<string>();

  reset() {
    this.step = 0;
    this.active = false;
    this.highlighted = false;
    this.conclusion = false;
    this.help.clear();
  }

  render(named: boolean) {
    const step = this.step;
    const target = named ? "flüssigen äußeren Erdkern" : "tiefen, flüssigen Bereich";
    const card = (label: string, body: string) => `<section class="investCard"><h3>${label}</h3><p>${body}</p></section>`;
    const details = [
      "",
      `<section class="investCard"><h3>Messung · South Napa, 24.08.2014</h3><p>Abgelesene Ankünfte in Sekunden nach 10:20:00 UTC.</p><table><thead><tr><th>Station</th><th>P</th><th>S</th></tr></thead><tbody>${stations.map(([name,p,s]) => `<tr><th>${name}</th><td>${p}</td><td>${s}</td></tr>`).join("")}</tbody></table><small>USGS ComCat · NC72282711 · drei regionale Stationen</small></section>
      <section class="investCard ${this.highlighted ? "marked" : ""}"><h3>Direkte Beobachtung und globales Muster</h3><p>Instrumente registrieren Bodenbewegung. Bei vielen Beben fehlen direkte S-Ankünfte ab etwa 103° Winkelabstand vom Epizentrum. Für starke direkte P-Ankünfte liegt die Schattenzone ungefähr zwischen 103° und 142°.</p><button id="markEvidence" aria-pressed="${this.highlighted}">Muster hervorheben</button></section>`,
      card("Wissenschaftliche Erklärung", "P-Wellen übertragen Verdichtung in Feststoffen und Flüssigkeiten. S-Wellen benötigen elastischen Widerstand gegen Scherung. Eine Flüssigkeit trägt diese Wellen im Erdinneren nicht.") +
        card("Zwei Erklärungen prüfen", "Ein Messausfall kann eine einzelne Lücke erklären. Eine Materialgrenze müsste dagegen bei vielen Beben ein entfernungsabhängiges Muster erzeugen. Welche Beobachtung unterscheidet beides?"),
      card("Modellannahme", "Vergleicht zwei Modelle. In einem trägt das Material überall Scherwellen. Im anderen liegt in der Tiefe eine flüssige Zone. Welche Wege wären jeweils möglich?") +
        `<button class="reveal" id="conclusion" aria-expanded="${this.conclusion}">${this.conclusion ? "Deutung ausblenden" : "Fachliche Deutung einblenden"}</button>` +
        (this.conclusion ? card("Schlussfolgerung", `Das systematische Fehlen direkter S-Wellen zusammen mit gebrochenen P-Phasen stützt das Modell mit einem ${target}. Die drei regionalen Messpaare allein reichen dafür nicht aus.`) : ""),
      card("Unsicherheit und Modellgrenze", "Aus einer fehlenden Ankunft lässt sich der Materialzustand nicht eindeutig bestimmen. Die regionalen Ankünfte zeigen eine Reihenfolge. Die globale Verteilung vieler Phasen grenzt den möglichen Aufbau ein.") +
        card("Weiter untersuchen", "Welche weiteren Signale würdet ihr suchen, um die Grenze oder den Zustand eines noch tieferen Bereichs zu bestimmen?"),
    ];
    const aids = [["starter","Satzanfang",starters[step]],["terms","Fachbegriff",terms[step]],["depth","Vertiefung",deeper[step]]];
    return `<div class="invest"><div class="eyebrow">HINWEISE AUS DEM ERDINNEREN · ${step + 1}/5</div><h2 tabindex="-1" id="investTitle">${titles[step]}</h2><div class="investBody"><p class="investQuestion">${prompts[step]}</p>${details[step]}
    <div class="investAids">${aids.map(([id,label]) => `<button data-aid="${id}" aria-expanded="${this.help.has(id)}">${label}</button>`).join("")}</div>${aids.filter(([id]) => this.help.has(id)).map(([,label,body]) => card(label,body)).join("")}
    </div><div class="investFooter"><div class="investNav"><button id="investPrev" ${step === 0 ? "disabled" : ""}>Zurück</button><button id="investNext" ${step === 4 ? "disabled" : ""}>Weiter</button></div><button id="pauseInvest">Zurück zum Schalenmodell</button></div></div>`;
  }

  bind(panel: HTMLElement, refresh: () => void) {
    const change = (delta: number) => {
      this.step += delta;
      this.conclusion = false;
      this.help.clear();
      refresh();
      panel.querySelector<HTMLElement>("#investTitle")?.focus();
    };
    const on = (id: string, fn: () => void) => panel.querySelector("#" + id)?.addEventListener("click", fn);
    on("investPrev", () => change(-1));
    on("investNext", () => change(1));
    on("pauseInvest", () => {
      this.active = false;
      refresh();
      panel.querySelector<HTMLElement>("#investigate")?.focus();
    });
    const redraw = (selector: string) => {
      refresh();
      panel.querySelector<HTMLElement>(selector)?.focus();
    };
    on("markEvidence", () => { this.highlighted = !this.highlighted; redraw("#markEvidence"); });
    on("conclusion", () => { this.conclusion = !this.conclusion; redraw("#conclusion"); });
    panel.querySelectorAll<HTMLButtonElement>("[data-aid]").forEach(button => {
      const key = button.dataset.aid!;
      button.onclick = () => {
        if (this.help.has(key)) this.help.delete(key);
        else this.help.add(key);
        redraw(`[data-aid="${key}"]`);
      };
    });
  }
}
