/** Project a live atlas diagram at smartboard size using the existing diagram-dialog presentation. */
export function enlargeFigure(title: string, chart: HTMLCanvasElement, detail: HTMLElement) {
  const open = document.createElement("button");
  open.type = "button";
  open.textContent = title + " groß zeigen";
  open.setAttribute("aria-haspopup", "dialog");
  open.onclick = () => {
    const dialog = document.createElement("dialog");
    dialog.className = "depth-analysis research-figure";
    dialog.setAttribute("aria-label", title);
    const header = document.createElement("header");
    const heading = document.createElement("h2");
    heading.textContent = title;
    const close = document.createElement("button");
    close.textContent = "Schließen";
    close.onclick = () => dialog.close();
    header.append(heading, close);
    const picture = chart.cloneNode(false) as HTMLCanvasElement;
    picture.hidden = false;
    picture.getContext("2d")!.drawImage(chart, 0, 0);
    const caption = document.createElement("div");
    for (const child of detail.childNodes) caption.append(child.cloneNode(true));
    dialog.append(header, picture, caption);
    dialog.onclose = () => dialog.remove();
    document.body.append(dialog);
    dialog.showModal();
    close.focus();
  };
  return open;
}
