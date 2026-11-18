export type NyosView = "lake" | "section" | "event" | "protection";
export type NyosMeasure = "pipe" | "monitor" | "settlements";

/** Normalized teaching time. Durations do not reconstruct the event of 1986. */
export class NyosLessonState {
  view: NyosView = "lake";
  measure: NyosMeasure = "pipe";
  progress = 0;
  playing = false;
  slow = false;
  dissolved = false;
  air = false;

  select(view: NyosView) {
    this.view = view;
    this.measure = "pipe";
    this.dissolved = false;
    this.air = false;
    this.reset();
  }
  reset() {
    this.progress = 0;
    this.playing = false;
    this.slow = false;
  }
  togglePlayback() {
    if (this.view !== "event" && !(this.view === "protection" && this.measure === "pipe")) return;
    if (this.progress >= 1) this.progress = 0;
    this.playing = !this.playing;
  }
  advance(seconds: number) {
    if (!this.playing || !Number.isFinite(seconds) || seconds <= 0) return;
    const duration = this.view === "event" ? 24 : 12;
    this.progress = Math.min(1, this.progress + seconds / duration * (this.slow ? 0.35 : 1));
    if (this.progress === 1) this.playing = false;
  }
}
