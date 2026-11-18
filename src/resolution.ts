// Windowed frame cadence includes GPU back-pressure. DOM and camera dimensions stay in CSS pixels.
export class RenderResolution {
  readonly minimum: number;
  readonly maximum: number;
  ratio: number;
  reductions = 0;
  recoveries = 0;
  private low = 0;
  private high = 0;
  private cooldown = 0;

  constructor(deviceRatio: number) {
    this.maximum = Math.min(deviceRatio, 1.5);
    this.minimum = Math.min(0.75, this.maximum);
    this.ratio = this.maximum;
  }

  resetWindow() {
    this.low = this.high = 0;
  }

  sample(fps: number, seconds: number) {
    if (this.cooldown > 0) {
      this.cooldown -= seconds;
      this.resetWindow();
      return;
    }
    this.low = fps < 24 ? this.low + seconds : 0;
    this.high = fps >= 45 ? this.high + seconds : 0;
    if (this.low >= 2 && this.ratio > this.minimum) {
      this.ratio = Math.max(this.minimum, this.ratio - 0.15);
      this.reductions++;
      this.cooldown = 3;
    } else if (this.high >= 8 && this.ratio < this.maximum) {
      this.ratio = Math.min(this.maximum, this.ratio + 0.1);
      this.recoveries++;
      this.cooldown = 6;
    } else return;
    this.resetWindow();
    return this.ratio;
  }
}
