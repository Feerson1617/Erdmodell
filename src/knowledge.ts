/** Normal incidence keeps the paths comparable. Arrows denote propagation, not particle trajectories. */
export function waveModel(named: boolean) {
  return `<h2 id="dialogTitle">P- und S-Wellen</h2>
  <figure class="waveFigure">
    <svg viewBox="0 0 640 216" role="img" aria-labelledby="waveTitle waveDesc">
      <title id="waveTitle">Vereinfachtes Modell einer Materialgrenze</title>
      <desc id="waveDesc">Die P-Welle läuft vom festen Material in die Flüssigkeit weiter. Die direkte S-Welle reicht nur bis zur Grenze.</desc>
      <rect x="0" y="0" width="320" height="216" fill="#35413c"/><rect x="320" width="320" height="216" fill="#193845"/>
      <path d="M320 0v216" stroke="#dae6dd" stroke-dasharray="5 6"/>
      <g fill="#f0f3e9" font-size="24"><text x="24" y="38">Festes Material</text><text x="345" y="38">Flüssigkeit</text></g>
      <g fill="#efc485" font-size="27" font-weight="600"><text x="24" y="95">P</text></g>
      <g fill="#a1ddd5" font-size="27" font-weight="600"><text x="24" y="165">S</text></g>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="6">
        <path d="M78 86H567m-14 -12 14 12-14 12" stroke="#efc485"/>
        <path d="M78 156H315m0 -12v24" stroke="#a1ddd5"/>
      </g>
    </svg><figcaption>Vereinfachtes Modell der Ausbreitung</figcaption>
  </figure>
  <p><strong>P-Wellen</strong> drücken Material zusammen und dehnen es wieder aus. Sie laufen durch feste Stoffe und Flüssigkeiten.</p>
  <p><strong>S-Wellen</strong> bewegen Material quer zur Ausbreitungsrichtung. Sie laufen durch feste Stoffe. In Flüssigkeiten breiten sie sich nicht aus.</p>
  ${named ? "<p class='inference'>Dass der äußere Erdkern flüssig ist, erschließen Forschende aus dem Muster der P- und S-Wellen vieler Erdbeben.</p>" : ""}`;
}
