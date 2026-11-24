import {claimObject} from "./observatory/reveal";
import {observeFrame,graphics,cadence} from "./observatory/graphics";
import * as T from "three";
import { CameraController, HOME, type Pose } from "./camera";
import { angularDistance, R, RAD, position, basis, smooth, clamp } from "./geo";
import { TerrainLODManager } from "./planet";
import { regions, firstRegion, nyosSite, tectonicSites, type Region, type TectonicSiteId } from "./regions";
import { LocalTerrain } from "./local";
import { project, type Annotation } from "./annotations";
import { Shells, shellRadii } from "./shells";
import { layers, type Style, styles } from "./model";
import { RenderResolution } from "./resolution";
import { NyosTerrain } from "./nyos/terrain";
import { NyosCoverage } from "./nyos/coverage";
import { NyosEvent } from "./nyos/event";
import { NyosLessonState, type NyosView, type NyosMeasure } from "./nyos/state";
import { reliefSites } from "./nyos/protection";
import { loadAtlas, center, typeOf, names, type BoundaryKind, type Step } from "./tectonics/atlas";
import mosaicUrl from "./tectonics/mosaic.json?url";
import plateCentres from "./tectonics/labels.json";
import {PlateMosaic, type SurfaceData} from "./tectonics/mosaic";
import {buildProfiles} from "./tectonics/plate-info";
import { SectionWindow } from "./tectonics/section-window";
import { regionalImagery } from "./tectonics/imagery";
import { ProcessModel, processView, PROCESS_FOCUS_HEIGHT } from "./tectonics/process";

interface PlateOptions {
  boundaries: boolean;
  names: boolean;
  types: boolean;
  category: "all" | BoundaryKind;
  plate: string;
}

export class World {
  customRender?: (dt:number)=>boolean;
  customPick?: (x:number,y:number)=>boolean;
  scene = new T.Scene();
  gl: T.WebGLRenderer;
  nav: CameraController;
  planet: TerrainLODManager;
  nyos: NyosTerrain;
  nyosDetail = true;
  readonly nyosLesson = new NyosLessonState();
  private nyosFocusOffset = 0;
  private nyosEvent?: NyosEvent;
  private nyosInputRevision = 0;
  private nyosAutoStarted = false;
  private nyosAutoFlight?: CameraController["flight"];
  private nyosVisitToken = 0;
  private nyosStage = "Globus";
  private nyosFarWeight = 0;
  private nyosMidWeight = 0;
  private nyosGround = 0;
  private nyosCoverage?: NyosCoverage;
  private globeOccluded = false;
  private terrains = new Map<string, LocalTerrain>();
  region: Region = firstRegion;
  get local() {
    return this.terrains.get(this.region.id)!;
  }
  private renderMs = 0;
  private terrainMs = 0;

  shell = new Shells();
  mode: "globe" | "inside" | "place" | "plates" | "nyos" = "globe";
  style: Style = "A";
  ready = false;
  fps = 0;
  frames = 0;
  private running = true;
  private waitingForAscent = false;
  private last = 0;
  private resolution = new RenderResolution(devicePixelRatio);
  private frameMs = 0;
  private shadowStamp = "";
  private fpsStart = 0;
  private frameCount = 0;
  private hemi = new T.HemisphereLight(0xfcffff, 0xa0acaa, 1.48);
  private sun = new T.DirectionalLight(0xfff1da, 2.05);
  private grid = new T.Group();
  private air: T.Mesh;
  private marker = position(firstRegion.target.lat, firstRegion.target.lon, 10);
  onFrame?: () => void;
  onLayer?: (i: number) => void;
  onBoundary?: () => void;
  plateOptions: PlateOptions = { boundaries: false, names: false, types: false, category: "all", plate: "" };
  mosaic?: PlateMosaic;
  profiles: ReturnType<typeof buildProfiles> = {};
  profileCode = "";
  singlePlateName = false;
  smallPlateNames = false;
  processChoice = "";
  private pickedPlatePoint?: T.Vector3;
  processSite: TectonicSiteId | null = null;
  processDetail = false;
  processProgress = 0;
  processPlaying = false;
  processLoop = false;
  processSlow = false;
  private atlas?: Awaited<ReturnType<typeof loadAtlas>>;
  private atlasLoading?: Promise<void>;
  private images?: T.Group;
  private imagesLoading?: Promise<void>;
  private sectionWindow = new SectionWindow();
  private models = new Map<TectonicSiteId, ProcessModel>();
  private selectedStep: Step | null = null;
  private atlasReturn: Pose = { ...HOME };
  private atlasFilters?: Pick<PlateOptions, "category" | "plate">;
  private anchor: { lat: number; lon: number } | null = null;
  private departure: { id: TectonicSiteId; lat: number; lon: number; showModel: boolean } | null = null;
  private patchOpacity = 0;
  private processReveal = 0;
  private focusOffset = 0;
  private focusReveal = 0;
  constructor(
    public canvas: HTMLCanvasElement,
    public warn: (s: string) => void,
  ) {
    this.gl = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.gl.setPixelRatio(this.resolution.ratio);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.autoUpdate = false;
    this.gl.shadowMap.type = T.PCFSoftShadowMap;
    this.gl.toneMapping = T.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.06;
    this.gl.setClearColor(0, 0);
    this.nav = new CameraController(canvas);
    this.planet = new TerrainLODManager(warn);
    this.nyos = new NyosTerrain((lat, lon) => this.planet.elevation(lat, lon));
    this.scene.add(this.nyos.group);
    for (const region of regions.values()) {
      const terrain = new LocalTerrain(region);
      this.terrains.set(region.id, terrain);
      this.scene.add(terrain.group);
    }
    this.scene.add(
      this.planet.group,
      this.shell.group,

      this.hemi,
      this.sun,
      this.sun.target,
      this.grid,
    );
    this.shell.group.visible = false;
    const lines: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30)
      for (let i = -180; i < 180; i += 2)
        lines.push(
          ...position(lat, i, 10).toArray(),
          ...position(lat, i + 2, 10).toArray(),
        );
    for (let lon = -180; lon < 180; lon += 30)
      for (let i = -90; i < 90; i += 2)
        lines.push(
          ...position(i, lon, 10).toArray(),
          ...position(i + 2, lon, 10).toArray(),
        );
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(lines, 3));
    this.grid.add(
      new T.LineSegments(
        g,
        new T.LineBasicMaterial({
          color: 0xd8edf0,
          transparent: true,
          opacity: 0.105,
          depthWrite: false,
        }),
      ),
    );
    this.air = new T.Mesh(
      new T.SphereGeometry(R * 1.021, 120, 64),
      new T.ShaderMaterial({
        transparent: true,
        side: T.BackSide,
        depthWrite: false,
        uniforms: { color: { value: new T.Color("#74b8d5") } },
        vertexShader: `varying vec3 n;varying vec3 eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=-p.xyz;gl_Position=projectionMatrix*p;}`,
        fragmentShader: `varying vec3 n;varying vec3 eye;uniform vec3 color;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),11.);gl_FragColor=vec4(color,rim*.46);}`,
      }),
    );
    this.scene.add(this.air);
    this.scene.fog = new T.FogExp2(0xb6cfd0, 0);
    this.nav.onPick = (x, y) => {
      if(this.customPick?.(x,y))return;
      if (this.mode !== "inside" && !(this.mode === "plates" && !this.processDetail && this.atlas)) return;
      const b = canvas.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((x - b.x) / b.width) * 2 - 1,
          1 - ((y - b.y) / b.height) * 2,
        ),
        this.nav.camera,
      );
      if (this.mode === "plates") {
        if (this.mosaic?.pair) {
          const sample=ray.intersectObjects(this.mosaic.pair.bodies,false)[0];
          if (sample) this.selectPairBody(sample.object.name);
          return;
        }
        const point = ray.ray.intersectSphere(new T.Sphere(new T.Vector3(), R), new T.Vector3());
        if (point) {
          const tolerance = (this.nav.pose.d * 2 * Math.tan(T.MathUtils.degToRad(this.nav.camera.fov / 2)) * 16) / (b.height * R);
          const direction = point.normalize();
          const boundary = this.plateOptions.boundaries && (this.processSite || this.plateOptions.types) ? this.atlas!.pick(direction,tolerance) : null;
          this.selectBoundary(boundary);
          if (!boundary && !this.processSite) {
            const hit = this.mosaic?.pick(ray);
            if (hit) { claimObject(hit.object.name);this.inspectPlate(hit.object.name, hit.point); this.mosaic!.track(hit); }
          }
          this.onBoundary?.();
        }
        return;
      }
      const hit = ray
        .intersectObjects(this.shell.parts, false)
        .find((entry) => entry.object.visible);
      if (hit) this.onLayer?.(hit.object.userData.layer);
    };
    new ResizeObserver(() => this.resize()).observe(canvas);
    document.addEventListener("visibilitychange", () => {
      this.last = 0;
      if (this.nav.flight?.paced) this.nav.flight.last = performance.now();
    });
    this.resize();
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.running = false;
      this.planet.uploadedTiles.clear();
      this.warn(
        "Grafikkontext unterbrochen. Seite neu laden, um das Modell wieder zu öffnen.",
      );
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.running = true;
      this.last = 0;
      requestAnimationFrame(this.render);
    });
  }
  private sizeDirty = true;
  resize() {
    this.sizeDirty = true;
  }
  private applySize() {
    this.sizeDirty = false;
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.gl.setSize(w, h, false);
    this.nav.camera.aspect = w / h;
    this.nav.camera.fov =
      w < h
        ? (2 * Math.atan((Math.tan((39 * Math.PI) / 360) * h) / w) * 180) /
          Math.PI
        : 39;
    this.nav.camera.updateProjectionMatrix();
  }
  private planetInitialized?: Promise<void>;
  async init() {
    try {
      this.planetInitialized = this.planet.init();
      await this.planetInitialized;
    } catch {
      this.warn("Basiskarte fehlt · Reliefkugel ohne Bilddaten");
    }
    this.setStyle("A");
    this.ready = true;
    requestAnimationFrame(this.render);
  }
  setStyle(s: Style) {
    this.style = s;
    this.planet.setStyle(s);
    for (const terrain of this.terrains.values()) terrain.setStyle(s);
    this.shell.style = s;
    this.shell.map = this.planet.maps[s] ?? this.planet.baseline;
    if (this.shell.map) {
      this.shell.map.wrapS = T.RepeatWrapping;
      if (this.shell.map.version === 0) this.shell.map.needsUpdate = true;
    }
    if (this.mode === "inside") this.shell.rebuild();
    this.hemi.intensity = styles[s].sky;
    this.sun.intensity = styles[s].sun;
  }
  private loadPlates() {
    if (!this.atlasLoading) {
      this.atlasLoading = Promise.all([
        loadAtlas((lat, lon) => this.planet.elevation(lat, lon)),
        fetch(mosaicUrl).then(async response => {
          if (!response.ok) throw new Error("Plattenflächen fehlen");
          return await response.json() as SurfaceData;
        }),
        this.planetInitialized,
      ]).then(([atlas, data]) => {
        const neighbours = new Map<string,Set<string>>(Object.keys(data).map(code => [code,new Set()]));
        for (const step of atlas.steps) {
          const a=step[1].slice(0,2), b=step[1].slice(-2);
          neighbours.get(a)?.add(b);
          neighbours.get(b)?.add(a);
        }
        this.profiles = buildProfiles(atlas.steps, names);
        this.mosaic = new PlateMosaic(data, this.planet.maps.A ?? this.planet.baseline!, neighbours);
        this.scene.add(this.mosaic.group);
        this.atlas = atlas;
        this.scene.add(atlas.group);
        this.updatePlateLayers();
        this.onBoundary?.();
      }).catch(() => {
        this.atlasLoading = undefined;
        this.warn("Plattendaten konnten nicht geladen werden. Plattenansicht erneut öffnen.");
      });
    }
    return this.atlasLoading;
  }
  private loadRegionalImages() {
    if (this.imagesLoading) return this.imagesLoading;
    this.imagesLoading = regionalImagery((lat, lon) => this.planet.elevation(lat, lon)).then((images) => {
      this.images = images;
      images.visible = false;
      this.scene.add(images);
    }).catch(() => {
      this.imagesLoading = undefined;
      this.warn("Regionales Satellitenbild fehlt · globale Erdkarte aktiv");
    });
    return this.imagesLoading;
  }
  private selectBoundary(step: Step | null) {
    this.selectedStep = step;
    this.atlas?.selectStep(step);
  }
  get selectedBoundary() {
    if (!this.selectedStep) return null;
    const pair = this.selectedStep[1];
    return { step:this.selectedStep, kind: typeOf(this.selectedStep[2]), plates: [names[pair.slice(0, 2)], names[pair.slice(-2)]] };
  }
  private updatePlateLayers() {
    if (!this.atlas) return;
    const { boundaries, types, category, plate } = this.plateOptions;
    const active = this.mode === "plates" && !this.processSite;
    if (this.mosaic) {
      if (active && this.nav.pose.d >= 340 && !this.mosaic.group.visible) this.mosaic.open(this.nav.camera.position, this.nav.reducedMotion.matches);
      if (!active && this.mosaic.group.visible) { this.mosaic.close(); this.profileCode = ""; }
      this.mosaic.selected = active ? plate : "";
    }
    this.nav.minimumDistance = active ? (this.mosaic?.pair ? 160 : 340) : .06;
    if (active && !this.nav.flight && this.nav.goal.d < this.nav.minimumDistance) this.nav.fly({...this.nav.goal, d: 500});
    this.atlas.setLayers(this.mode === "plates" && !this.mosaic?.pair && boundaries, types, types && category !== "all" ? category : null, active ? null : plate || null);
  }
  setPlateOptions(options: Partial<PlateOptions>) {
    if (options.plate !== undefined || options.names !== undefined || options.boundaries === false) this.singlePlateName = false;
    if (options.plate !== undefined) this.pickedPlatePoint = undefined;
    if (options.names === false) this.processChoice = "";
    Object.assign(this.plateOptions, options);
    const { types, category, boundaries } = this.plateOptions;
    if (this.selectedStep && (!boundaries || (types && category !== "all" && typeOf(this.selectedStep[2]) !== category))) {
      this.selectBoundary(null);
    }
    this.updatePlateLayers();
  }
  inspectPlate(code: string, point?: T.Vector3) {
    if (code && !this.profiles[code]) return;
    this.mosaic?.endPair(!this.nav.reducedMotion.matches);
    this.setPlateOptions({plate:code});
    this.mosaic?.clearAnchor();
    this.singlePlateName = !!code;
    this.profileCode = code;
    this.pickedPlatePoint = point?.clone();
    this.selectBoundary(null);
  }
  atlasWorld() {
    this.inspectPlate("");
    this.atlasReturn = {...HOME};
    this.nav.fly(HOME);
  }
  private fitSlope() {
    const view=this.canvas.getBoundingClientRect();
    const panel=document.getElementById("sidebar")!.getBoundingClientRect();
    const overlay=panel.bottom>view.top+10 && panel.top<view.bottom-10 && panel.left<view.left+40;
    const halfWidth=Math.max(view.width*.22,view.width/2-(overlay ? panel.right-view.left+14 : 20));
    const halfHeight=Math.max(60,view.height/2-62);
    return 2*Math.min(halfWidth,halfHeight)*Math.tan(this.nav.camera.fov*RAD/2)/view.height;
  }
  selectPairBody(code:string){
    const pair=this.mosaic?.pair;
    if(!pair)return;
    claimObject(code);
    for(const body of pair.bodies)(body.material as T.MeshStandardMaterial).emissive.setHex(body.name===code?0x302817:0);
    const area=document.getElementById("pair-object");
    if(area){area.hidden=false;area.textContent=names[code]+" · "+this.profiles[code].place;}
  }
  get pairKind() { return this.mosaic?.pair && typeOf(this.mosaic.pair.step[2]); }
  comparePlates(autoplay:boolean, stepId?:number) {
    if (!this.atlas || !this.mosaic) return;
    if (!this.mosaic.pair || stepId) {
      const step=stepId?this.atlas.steps[stepId-1]:this.selectedStep;
      const code=step?.[1].slice(0,2)||this.profileCode || "EU";
      const profile=this.profiles[code];
      this.inspectPlate(code);
      const pair=this.mosaic.beginPair(step??this.atlas.steps[profile.step-1]);
      this.updatePlateLayers();
      const d=Math.max(180,pair.span/(.86*this.fitSlope()));
      this.nav.fly({...pair.site,d,tilt:32,bearing:pair.heading},true);
    }
    if (autoplay) this.mosaic.play();
  }
  locatePlate() {
    const coordinates = plateCentres[this.profileCode as keyof typeof plateCentres];
    if (!coordinates) return;
    const [lon,lat] = coordinates;
    this.pickedPlatePoint = position(lat,lon,2);
    const angle=Math.min(62*RAD,this.mosaic!.extents.get(this.profileCode)!);
    const distance=R*(Math.sin(angle)/(.72*this.fitSlope())-(1-Math.cos(angle)));
    this.nav.fly({lon,lat,d:clamp(distance,340,19500),tilt:0,bearing:0},true);
  }
  async loadClassroomAtlas(regional:boolean){await this.loadPlates();if(regional)await this.loadRegionalImages();}
  get atlasReady() { return !!this.atlas; }
  get annotationTransition() { return this.processSite ? this.processReveal : this.mosaic?.annotationPose ?? 0; }
  plateLabels() {
    if (this.mosaic?.pair && this.mode==="plates")
      return this.mosaic.pair.labels(this.nav.camera,this.canvas.clientWidth,this.canvas.clientHeight);
    if (!this.atlas || this.mode !== "plates" || !(this.plateOptions.names || this.singlePlateName) || this.processReveal > 0.5) return [];
    return this.atlas.labels(this.nav.camera, this.canvas.clientWidth, this.canvas.clientHeight, this.nav.pose.d, this.processSite ?? undefined,this.plateOptions.plate,this.mosaic?.anchor() ?? this.pickedPlatePoint,this.singlePlateName && !this.plateOptions.names,this.smallPlateNames);
  }
  plates() {
    this.nyosLesson.playing = false;
    if (this.mode === "plates" && this.processSite) {
      this.plateOverview();
      return;
    }
    if (this.mode === "place" || this.mode === "inside" || this.mode === "nyos") this.nav.fly(this.atlasReturn, this.mode === "nyos");
    this.mode = "plates";
    this.updatePlateLayers();
    void this.loadPlates();
  }
  private leaveProcess(keepFilters = false) {
    this.nyosLesson.playing = false;
    if (this.atlasFilters && !keepFilters) {
      this.setPlateOptions(this.atlasFilters);
      this.atlasFilters = undefined;
    }
    const id = this.processSite;
    if (id && this.anchor && (this.processReveal > 0 || this.patchOpacity > 0)) {
      if (this.departure && this.departure.id !== id) {
        const previous = this.models.get(this.departure.id);
        if (previous) previous.group.visible = false;
      }
      this.departure = { id, ...this.anchor, showModel: this.processReveal > 0 };
    }
    this.processChoice = "";
    this.processSite = null;
    this.processDetail = false;
    this.anchor = null;
    this.processReveal = 0;
    this.nav.orbit = false;
    this.resetProcess();
    this.patchOpacity = 0;
    this.selectBoundary(null);
  }
  plateOverview() {
    this.leaveProcess();
    this.mode = "plates";
    this.nav.fly(this.atlasReturn, true);
    this.updatePlateLayers();
    void this.loadPlates();
  }
  private visitBoundary(id: TectonicSiteId, overview: boolean) {
    if (!this.processSite) {
      if (this.mode === "globe" || this.mode === "plates") this.atlasReturn = { ...this.nav.pose };
      else this.atlasReturn = { ...HOME };
      this.atlasFilters = { category: this.plateOptions.category, plate: this.plateOptions.plate };
    }
    this.leaveProcess(true);
    this.mode = "plates";
    this.processSite = id;
    this.processDetail = !overview;
    // A global filter such as divergence must not hide the Japan trench.
    this.setPlateOptions({ boundaries: true, category: "all", plate: "" });
    const arrive = () => {
      if (!this.atlas || this.mode !== "plates" || this.processSite !== id || this.processDetail === overview) return;
      const site = tectonicSites[id];
      const step = this.atlas.steps[site.stepId - 1];
      this.anchor = center(step);
      this.selectBoundary(step);
      if (!overview) {
        let model = this.models.get(id);
        if (!model) {
          model = new ProcessModel(id, this.anchor,(lat,lon) => this.planet.elevation(lat,lon),this.images?.getObjectByName(id)?.userData.image);
          model.group.visible = false;
          this.models.set(id, model);
          this.sectionWindow.attach(this.planet.material);
          const regionalMap = this.images?.getObjectByName(id) as T.Mesh<T.BufferGeometry,T.Material> | undefined;
          if (regionalMap) this.sectionWindow.attach(regionalMap.material);
          this.scene.add(model.group);
        }
        model.setProgress(0);
      }
      const close = processView(id);
      this.nav.fly({
        ...this.anchor,
        ...(overview ? { d: site.regionalDistance, tilt: 8, bearing: 0 } : close),
      }, true);
      if (this.images?.userData.missing.includes(id)) this.warn("Regionales Satellitenbild fehlt · globale Erdkarte aktiv");
      this.onBoundary?.();
    };
    if (this.atlas && this.images) arrive();
    else void Promise.all([this.loadPlates(), this.loadRegionalImages()]).then(arrive);
  }
  toggleProcess() {
    if (!this.processDetail || !this.processSite) return;
    if (this.processProgress >= 1) this.resetProcess();
    this.processPlaying = !this.processPlaying;
  }
  resetProcess() {
    this.processPlaying = false;
    this.processProgress = 0;
    if (this.processSite) this.models.get(this.processSite)?.setProgress(0);
  }
  private updateTectonics(dt: number) {
    const id = this.processSite;
    if (!id && !this.departure) {
      this.sectionWindow.show(undefined,0);
      return;
    }
    const { d, lat, lon } = this.nav.pose;
    const visibleAt = (anchor: { lat: number; lon: number }, near: number, span: number) => {
      const deltaLon = angularDistance(anchor.lon, lon);
      const offset = Math.hypot(lat - anchor.lat, deltaLon * Math.cos(lat * Math.PI / 180));
      return 1 - smooth((offset - near) / span);
    };
    const regional = 1 - smooth((d - 1800) / 1800);
    const detail = 1 - smooth((d - 155) / 320);
    this.patchOpacity = id && this.anchor && this.images && !this.images.userData.missing.includes(id)
      ? regional * visibleAt(this.anchor, 8, 10) : 0;
    this.processReveal = this.processDetail && this.anchor ? detail * visibleAt(this.anchor, 0.8, 1.5) : 0;

    // Keep the outgoing imagery and block in world coordinates until the shared
    // camera ascends past the corresponding scale. This also covers inter-site travel.
    let departingPatch = 0, departingModel = 0;
    const old = this.departure;
    if (old) {
      departingPatch = regional * visibleAt(old, 8, 10);
      departingModel = old.showModel ? detail * visibleAt(old, 0.8, 1.5) : 0;
      const model = this.models.get(old.id);
      if (model && !(id === old.id && this.processDetail)) {
        model.group.visible = departingModel > 0;
        if (model.group.visible) model.setReveal(departingModel);
      }
      if ((departingPatch <= 0 && departingModel <= 0) || (id === old.id && (this.processDetail || departingModel <= 0))) {
        this.departure = null;
      }
    }
    this.focusReveal = Math.max(this.processReveal, departingModel);
    const cutSite = this.processReveal >= departingModel ? id : old?.id;
    this.sectionWindow.show(cutSite ? this.models.get(cutSite)?.group : undefined,this.focusReveal);
    this.atlas?.setOpacity(1 - this.focusReveal);
    if (this.images) {
      this.images.visible = this.patchOpacity > 0 || departingPatch > 0;
      for (const image of this.images.children) {
        const opacity = Math.max(image.name === id ? this.patchOpacity : 0, image.name === old?.id ? departingPatch : 0);
        image.visible = opacity > 0;
        if (image.visible) ((image as T.Mesh).material as T.MeshLambertMaterial).opacity = opacity;
      }
    }
    this.nav.orbit = this.processReveal > 0.5;
    if (!id || !this.processDetail) return;
    const model = this.models.get(id);
    if (!model) return;
    model.group.visible = this.processReveal > 0;
    if (!model.group.visible) return;
    model.setReveal(this.processReveal);
    if (this.processPlaying && !this.nav.flight) {
      this.processProgress += dt / (this.processSlow ? 26 : 13);
      if (this.processProgress >= 1) {
        if (this.processLoop) this.processProgress %= 1;
        else { this.processProgress = 1; this.processPlaying = false; }
      }
      model.setProgress(this.processProgress);
    }
  }
  get nyosWarning() {
    return this.mode === "nyos" && this.nyos.error && !this.nyos.ready
      ? "Nyos-Geländedaten fehlen · regionale Ersatzansicht" : "";
  }
  showNyos(view: NyosView) {
    this.visitNyos(false, view);
  }
  showNyosMeasure(measure: NyosMeasure) {
    this.visitNyos(false, "protection", measure);
  }
  private visitNyos(overview: boolean, view: NyosView = "lake", measure: NyosMeasure = "pipe") {
    this.nyosLesson.select(view);
    this.nyosLesson.measure = measure;
    this.nyosInputRevision = this.nav.inputRevision;
    this.nyosAutoStarted = false;
    this.nyosAutoFlight = undefined;
    this.leaveProcess();
    this.mode = "nyos";
    this.updatePlateLayers();
    this.nyosDetail = !overview;
    const token = ++this.nyosVisitToken;
    const arrive = () => {
      if (this.mode !== "nyos" || this.nyosVisitToken !== token) return;
      const meta = this.nyos.meta;
      const target = { ...nyosSite.target, ...(meta?.anchor ?? {}) };
      if (meta && this.nyos.ready) {
        if (!this.nyosCoverage && meta.heightRangeM)
          this.nyosCoverage = new NyosCoverage(meta, meta.heightRangeM[0] / 1000);
        this.planet.setNyosMaps(meta.bounds, meta.regional?.bounds, this.nyos.regionTexture,
          meta.vicinity?.bounds, this.nyos.vicinityTexture);
        if (view === "protection" && measure === "settlements") {
          const [valley, slope] = reliefSites;
          this.nav.fly({
            lat: (valley.lat + slope.lat) / 2, lon: (valley.lon + slope.lon) / 2,
            d: this.nav.camera.aspect < 1.3 ? 2.75 : 2.4, tilt: 55, bearing: 3,
          }, true);
        } else if (this.nyosSectionActive())
          this.nav.fly({ ...target, d: this.nav.camera.aspect < 1.3 ? 2.75 : 2.2, bearing: 80, tilt: 66 }, true);
        else this.nav.fly(overview ? { ...target, ...nyosSite.overview } : target, true);
      } else {
        this.nyosDetail = false;
        this.nyosLesson.select("lake");
        this.nav.fly({ ...target, d: 1950, tilt: 3, bearing: 0 }, true);
      }
    };
    if (this.nyos.ready) arrive();
    else void this.nyos.load().then(arrive);
  }
  nyosPin() {
    if (this.mode !== "nyos" || this.nav.pose.d < 22) return null;
    const {lat, lon} = this.nyos.meta?.anchor ?? nyosSite.target;
    const p = position(lat, lon, this.nyos.meta ? this.nyos.meta.waterLevelM / 1000 : this.planet.elevation(lat, lon));
    const camera = this.nav.camera;
    if (p.dot(camera.position) <= p.lengthSq()) return null;
    p.project(camera);
    if (Math.abs(p.x) > .96 || Math.abs(p.y) > .91 || Math.abs(p.z) > 1) return null;
    return { x: (p.x + 1) * this.canvas.clientWidth / 2, y: (1 - p.y) * this.canvas.clientHeight / 2 };
  }
  nyosReliefLabels() {
    if (this.mode !== "nyos" || this.nyosLesson.view !== "protection" ||
        this.nyosLesson.measure !== "settlements" || this.nyos.localWeight < 0.98 ||
        this.nav.pose.d > 8) return [];
    const camera = this.nav.camera, probe = new T.Vector3();
    return reliefSites.flatMap(site => {
      const ground = this.nyos.ground(site.lat, site.lon);
      if (ground === null) return [];
      const tip = position(site.lat, site.lon, ground + 0.065);
      const screen = tip.clone().project(camera);
      if (Math.abs(screen.x) > .97 || Math.abs(screen.y) > .92 || Math.abs(screen.z) > 1) return [];
      // Keep a label with its surveyed relief point when the teacher orbits behind a ridge.
      for (let step = 1; step < 24; step++) {
        probe.copy(camera.position).lerp(tip, step / 24);
        const r = probe.length();
        const elevation = this.nyos.ground(Math.asin(probe.y / r) / RAD, Math.atan2(probe.x, probe.z) / RAD);
        if (elevation !== null && r < R + elevation) return [];
      }
      return [{
        label: site.name === "Talsohle" ? "Talboden" as const : "Hang" as const,
        x: (screen.x + 1) * this.canvas.clientWidth / 2,
        y: (1 - screen.y) * this.canvas.clientHeight / 2,
      }];
    });
  }
  private advanceNyosTime() {
    const lesson = this.nyosLesson;
    if (this.mode !== "nyos" || !this.nyos.ready || !lesson.playing) return;
    if (this.nav.flight && this.nav.flight !== this.nyosAutoFlight) return;
    if (this.nyos.localWeight <= 0) return;
    // Normalized explanatory time. Ignore suspended tabs and cap extreme stalls.
    const travelling = !!this.nav.flight && this.nav.flight === this.nyosAutoFlight;
    // While entering the valley, camera and explanation use the same visual clock.
    lesson.advance(Math.min(travelling ? 0.125 : 0.5, this.frameMs / 1000));
    if (lesson.view !== "event" || lesson.progress < 0.64 || this.nyosAutoStarted) return;
    this.nyosAutoStarted = true;
    if (this.nav.inputRevision !== this.nyosInputRevision) return;
    this.nav.fly({lat: 6.447, lon: 10.297, d: 4.25, tilt: 41, bearing: 16}, true, 2900);
    this.nyosAutoFlight = this.nav.flight;
  }
  private nyosSectionActive() {
    const { view, measure, progress } = this.nyosLesson;
    return this.mode === "nyos" && (view === "section" || (view === "event" && progress < 0.68) ||
      (view === "protection" && measure !== "settlements"));
  }
  private updateNyos(lat: number, lon: number, d: number, inside: boolean) {
    if (!this.nyos.ready) return;
    const target = this.nyos.meta!.anchor;
    const offset = Math.hypot(lat - target.lat, angularDistance(target.lon, lon) * Math.cos(lat * RAD));
    // Keep the georeferenced geography under the camera as it ascends or passes
    // into another site. Overlays belonging to a lesson are limited to Nyos mode.
    const regional = !inside && offset < 28;
    const local = regional && offset < 0.5;
    this.nyosFarWeight = regional && this.nyos.regionTexture ? 1 - smooth((d - 490) / 1500) : 0;
    this.nyosMidWeight = regional && this.nyos.vicinityTexture ? 1 - smooth((d - 48) / 125) : 0;
    this.nyos.update(d, local);
    const detailed = this.nyos.localWeight > 0;
    const eventActive = this.mode === "nyos" && this.nyosLesson.view === "event";
    this.nyos.setSection(this.nyosSectionActive());
    if (eventActive && this.nyos.section && !this.nyosEvent) {
      this.nyosEvent = new NyosEvent(this.nyos, this.nyos.section);
      this.nyos.group.add(this.nyosEvent.group);
    }
    this.nyosEvent?.update(this.nyosLesson.progress, this.nyosLesson.air, eventActive && detailed);
    const protection = this.mode === "nyos" && this.nyosLesson.view === "protection";
    this.nyos.setDissolved(this.nyosLesson.dissolved && this.mode === "nyos");
    this.nyos.setProtection(protection && detailed, this.nyosLesson.measure, this.nyosLesson.progress);
    this.planet.setNyosWeights(this.nyosFarWeight, this.nyosMidWeight, this.nyos.localWeight);
    this.nyosStage = d > 6200 ? "Afrika" : d > 1500 ? "Kamerun" : d > 260 ? "Kamerun-Vulkanlinie" :
      d > 45 ? "Vulkanisches Hochland" : d > 6 ? "Umgebung des Nyos-Sees" : "Nyos-See";
    if (this.mode === "nyos") {
      this.nav.orbit = local && d < 20;
      this.nav.orbitMinimum = 0.58;
    } else this.nav.orbitMinimum = 38;
  }
  private nyosDiagnostics() {
    const eye = this.nav.camera.position, radius = eye.length();
    const floor = radius && this.nyos.ready
      ? this.nyos.ground(Math.asin(eye.y / radius) / RAD, Math.atan2(eye.x, eye.z) / RAD) : null;
    return {
      ...this.nyos.diagnostics(), ...this.nyosLesson,
      eventVisual: this.nyosEvent?.diagnostics() ?? { risingWater: false, freeBubbles: 0, surfaceRelease: false, reliefAnalysis: false },
      ready: this.nyos.ready, error: this.nyos.error,
      detail: this.mode === "nyos" && this.nyosDetail, stage: this.nyosStage, distance: this.nav.pose.d,
      regionalWeight: this.nyosFarWeight, vicinityWeight: this.nyosMidWeight, localWeight: this.nyos.localWeight,
      globeOccluded: this.globeOccluded, focusHeightKm: this.nyosFocusOffset,
      terrainVisible: this.nyos.ready && this.nyos.localWeight > 0, groundKm: this.nyosGround,
      cameraClearanceKm: floor === null ? null : radius - R - floor,
      nearKm: this.nav.camera.near, farKm: this.nav.camera.far,
      anchor: this.nyos.meta?.anchor ?? {lat: nyosSite.target.lat, lon: nyosSite.target.lon},
    };
  }
  visit(id = firstRegion.id, overview = false) {
    if (id === nyosSite.id) {
      this.visitNyos(overview);
      return;
    }
    if (Object.hasOwn(tectonicSites, id)) {
      this.visitBoundary(id as TectonicSiteId, overview);
      return;
    }
    const r = regions.get(id);
    if (!r) return;
    const fromProcess = !!this.processSite;
    this.leaveProcess();
    this.region = r;
    this.local.setStyle(this.style);
    this.mode = "place";
    this.updatePlateLayers();
    const target = overview ? { ...r.target, ...r.overview } : r.target;
    this.nav.fly(target, fromProcess);
    const flight = this.nav.flight;
    void this.local.load().then(() => {
      if (
        !this.local.ready &&
        this.region === r &&
        this.mode === "place" &&
        (this.nav.flight === flight || this.nav.pose.d <= target.d + 0.001)
      )
        this.nav.fly({ ...target, d: r.lod.fallbackKm, tilt: 0, bearing: 0 });
    });
  }
  globe(forceHome = false) {
    const wasNyos = this.mode === "nyos";
    const wasAtlas = this.mode === "plates";
    const wasLocal = this.processSite !== null;
    this.leaveProcess();
    this.mode = "globe";
    this.updatePlateLayers();
    if (forceHome) { this.inspectPlate(""); this.processSlow = false; this.processLoop = false; }
    if (forceHome || !wasAtlas) this.nav.fly(HOME, wasLocal || wasNyos);
    else if (wasLocal) this.nav.fly(this.atlasReturn, true);
  }
  inside() {
    this.waitingForAscent = this.mode !== "inside" && this.nav.pose.d < 3500;
    this.leaveProcess();
    this.mode = "inside";
    this.updatePlateLayers();
    this.shell.rebuild();
    this.nav.fly({ ...HOME, lon: 3, lat: 17 }, !!this.departure);
  }
  layerMarkers(released: ReadonlySet<number>, all: boolean): Annotation[] {
    const camera = this.nav.camera;
    const lon = Math.atan2(camera.position.x, camera.position.z) * 180 / Math.PI;
    if (!this.shell.cut || !this.shell.group.visible || lon <= -25 || lon >= 65) return [];
    // The camera lies in the convex removed wedge. Its segment to either cut face stays in air.
    const face = lon < 20 ? 65 : -25, radii = shellRadii(this.shell.expanded);
    const markers: Annotation[] = [];
    const mark = (id: string, name: string, text: string, lat: number, radius: number) => {
      const xy = project(position(lat,face,radius-R),camera,this.canvas.clientWidth,this.canvas.clientHeight);
      if (xy) markers.push({id,name,text,...xy});
    };
    layers.forEach((l,i) => {
      if ((all || released.has(i)) && this.shell.visible[i])
        mark("shell-"+i,l.name,l.text,[49,15,-9,-46][i],(radii[i]+radii[i+1])/2);
    });
    if (all && this.shell.lithosphere && this.shell.visible[0] && this.shell.visible[1])
      mark("lithosphere","Lithosphäre","Die Erdkruste und der starre oberste Erdmantel bilden zusammen die Lithosphäre. Ihre Dicke ist örtlich verschieden.",29,radii[1]-60);
    return markers;
  }
  processObjects() {
    return this.processSite ? this.models.get(this.processSite)?.objects() ?? [] : [];
  }
  processLabels() {
    if (!this.processSite || !this.processDetail || this.processReveal < .95) return [];
    return this.models.get(this.processSite)?.labels(this.nav.camera,this.canvas.clientWidth,this.canvas.clientHeight,this.processChoice) ?? [];
  }
  markerPosition() {
    const c = this.nav.camera;
    const p = this.marker.clone().project(c);
    return {
      x: (p.x + 1) * 50,
      y: (1 - p.y) * 50,
      visible:
        this.marker.dot(c.position.clone().sub(this.marker)) > 0 &&
        this.mode !== "inside" &&
        this.nav.pose.d > 1600 &&
        p.z < 1,
    };
  }
  /** Geographic coverage of the unobstructed atlas viewport, sampled only during acceptance tests. */
  atlasCoverage() {
    if (!this.atlas || !this.mosaic?.group.visible) return [];
    const box=this.canvas.getBoundingClientRect(), ray=new T.Raycaster(), sphere=new T.Sphere(new T.Vector3(),R);
    const grid=[];
    for(let j=0;j<15;j++)for(let i=0;i<23;i++) {
      const x=(i+.5)/23, y=(j+.5)/15;
      if(document.elementFromPoint(box.x+x*box.width,box.y+y*box.height)!==this.canvas)continue;
      ray.setFromCamera(new T.Vector2(2*x-1,1-2*y),this.nav.camera);
      const hit=ray.ray.intersectSphere(sphere,new T.Vector3());
      if(hit)grid.push({x,y,code:this.atlas.plateAt(hit.normalize())});
    }
    return grid;
  }
  diagnostics() {
    const { lat, lon, d, tilt, bearing } = this.nav.pose;
    return {
      ready: this.ready,
      mode: this.mode,
      style: this.style,
      lat,
      lon,
      d,
      tilt,
      bearing,
      flying: !!this.nav.flight,
      fps: this.fps,
      frames: this.frames,renderedFrames:cadence.frames,frameKinds:{...cadence.totals},qualityChanges:cadence.changes.slice(),
      pixelRatio: this.gl.getPixelRatio(),
      frameMs: this.frameMs,
      resolution: { initial: this.resolution.maximum, minimum: this.resolution.minimum, maximum: this.resolution.maximum, width: this.canvas.width, height: this.canvas.height, reductions: this.resolution.reductions, recoveries: this.resolution.recoveries },
      tiles: this.planet.tileCount,
      uploadedTiles: this.planet.uploadedTiles.size,
      cachedTiles: this.planet.cachedTileCount,
      region: this.mode === "nyos" ? nyosSite.id : this.processSite ?? this.region.id,
      nyos: this.nyosDiagnostics(),
      renderMs: this.renderMs,
      terrainMs: this.terrainMs,
      programs: this.gl.info.programs?.length,
      tectonics: {
        ...this.plateOptions,
        mosaic: this.mosaic?.diagnostics(this.nav.camera,this.canvas.clientWidth,this.canvas.clientHeight),
        ready: !!this.atlas, count: this.atlas?.steps.length ?? 0,
        selected: this.selectedStep?.[0] ?? null, site: this.processSite, anchor: this.anchor,
        patchOpacity: this.patchOpacity, processVisible: this.processReveal > 0 && !!this.processSite && this.models.has(this.processSite),
        reveal: this.processReveal, detail: this.processDetail, progress: this.processProgress,
        playing: this.processPlaying, loop: this.processLoop, slow: this.processSlow,
        models: this.models.size, focusHeight: this.focusOffset,
        model: this.processSite ? this.models.get(this.processSite)?.diagnostics(this.nav.camera,this.canvas.clientWidth,this.canvas.clientHeight) ?? null : null,
        processBearing: this.processSite ? processView(this.processSite).bearing : null,
        processDistance: this.processSite ? processView(this.processSite).d : null,
      },
      shell: {
        radii: shellRadii(this.shell.expanded),
        cut: this.shell.cut,
        expanded: this.shell.expanded,
        lithosphere: this.shell.lithosphere,
        selected: this.shell.selected,
        visible: [...this.shell.visible],
        opacity: [...this.shell.opacity],
        subdued: this.shell.subdued,
        builds: this.shell.builds,
        shadowPass: this.sun.castShadow,
        transparentParts: this.shell.group.children.filter(part => part.visible && part instanceof T.Mesh && part.material.transparent).length,
      },
      localReady: this.local.ready,
      localVisible: this.local.group.visible,
      draws: this.gl.info.render.calls,
      triangles: this.gl.info.render.triangles,
      ...this.gl.info.memory,
    };
  }
  private render = (now: number) => {
    if (!this.running) return;
    requestAnimationFrame(this.render);
    if (document.hidden) { this.last = 0; return; }

    if (!this.last || now - this.last > 2000) {
      this.fpsStart = now;
      this.frameCount = 0;
      this.resolution.resetWindow();
    }
    this.frameMs = this.last ? now - this.last : 0;
    const dt = clamp((now - this.last) / 1000, 0.001, 0.12);
    this.last = now;
    if (this.sizeDirty) this.applySize();
    this.frames++;
    this.frameCount++;
    if (now - this.fpsStart >= 900) {
      this.fps = (this.frameCount * 1000) / (now - this.fpsStart);
      this.frameCount = 0;
      this.fpsStart = now;
    }
    this.advanceNyosTime();
    const holdEventFlight = !!this.nyosAutoFlight && this.nav.flight === this.nyosAutoFlight &&
      !this.nyosLesson.playing && this.nyosLesson.progress < 1;
    this.nav.update(now, dt, ({ lat, lon, d }) => {
      const insideNow = this.mode === "inside" && (!this.waitingForAscent || d >= 3500);
      this.updateNyos(lat, lon, d, insideNow);
      let ground = insideNow ? 0 : Math.max(
        ...Array.from(this.terrains.values(), terrain => terrain.ground(lat, lon)),
        this.planet.elevation(lat, lon),
      );
      if (this.nyos.localWeight > 0) {
        const localGround = this.nyos.ground(lat, lon);
        if (localGround !== null) ground += (localGround - ground) * this.nyos.localWeight;
      }
      this.nyosGround = ground;
      // Play the geological timeline in wall time, but never leap over a whole
      // phase after a suspended tab or an unusually long upload.
      this.updateTectonics(Math.min(this.frameMs / 1000, 0.45));
      // Sample the target height at the SAME pose as the imagery and process.
      // Reduced-motion journeys also arrive correctly framed on their first frame.
      this.focusOffset = this.focusReveal * PROCESS_FOCUS_HEIGHT;
      const sectionHeight = this.nyosSectionActive() ? -0.07 * this.nyos.localWeight : 0;
      if (this.nav.reducedMotion.matches) this.nyosFocusOffset = sectionHeight;
      else if (!holdEventFlight)
        this.nyosFocusOffset += (sectionHeight - this.nyosFocusOffset) * (1 - Math.exp(-6 * dt));
      return ground + this.focusOffset + this.nyosFocusOffset;
    }, this.mode === "nyos" && this.nyos.ready ? (lat, lon) => this.nyos.ground(lat, lon) : undefined, holdEventFlight);
    const { lat, lon, d } = this.nav.pose;
    if (d >= 3500 || !this.nav.flight) this.waitingForAscent = false;
    const inside = this.mode === "inside" && !this.waitingForAscent,
      zoom = 1 - smooth((d - 2) / 58);
    const intactLandscape = this.nyosLesson.view === "lake" ||
      (this.nyosLesson.view === "protection" && this.nyosLesson.measure === "settlements");
    this.globeOccluded = intactLandscape && this.nyos.localWeight === 1 && !!this.nyosCoverage?.containsView(this.nav.camera);
    if (this.mosaic && !this.mosaic.group.visible && this.mode === "plates" && !this.processSite && d >= 340)
      this.mosaic.open(this.nav.camera.position,this.nav.reducedMotion.matches);
    this.mosaic?.tick(Math.min(.30,this.frameMs/1000),this.nav.reducedMotion.matches,!!this.nav.flight);
    const mosaicVisible = !!this.mosaic?.group.visible;
    this.planet.group.visible = !inside && !mosaicVisible && !this.globeOccluded;
    this.shell.group.visible = inside;
    this.air.visible = !inside && d > 2200;
    this.grid.visible = !mosaicVisible && !inside && d > 2400;
    const before = performance.now();
    if (this.planet.group.visible) this.planet.update(lat, lon, d);
    this.terrainMs = performance.now() - before;
    for (const terrain of this.terrains.values()) {
      if (terrain === this.local || terrain.ready)
        terrain.update(lat, lon, d, now);
      if (inside || mosaicVisible) terrain.group.visible = false;
    }
    const b = basis(lat, lon),
      target = position(lat, lon),
      dir = b.up
        .clone()
        .multiplyScalar(0.91)
        .addScaledVector(b.north, 1.05)
        .addScaledVector(b.east, -1.2)
        .normalize();
    this.planet.setObservatoryLight(this.mode==="globe"?smooth((d-1800)/5200):0);
    this.planet.lightDirection(dir);
    this.nyos.lightDirection(dir);
    const shadow = this.local.group.visible && d < 2.3;
    this.sun.castShadow = shadow;
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(dir, shadow ? 4 : 20000);
    if (shadow) {
      const cam = this.sun.shadow.camera,
        r = d > 1 ? 2.5 : 0.9;
      const anchored = position(
        Math.round(lat * 150) / 150,
        Math.round(lon * 100) / 100,
      );
      this.sun.target.position.copy(anchored);
      this.sun.position.copy(anchored).addScaledVector(dir, 4);
      Object.assign(cam, {
        left: -r,
        right: r,
        top: r,
        bottom: -r,
        near: 0.1,
        far: 9,
      });
      cam.updateProjectionMatrix();
      this.sun.shadow.bias = -0.00012;
      this.sun.shadow.normalBias = 0.0003;
      const stamp = [
        Math.round(lat * 150),
        Math.round(lon * 100),
        r.toFixed(3),
        this.style,
        this.local.ready,
      ].join("/");
      if (stamp !== this.shadowStamp) {
        this.gl.shadowMap.needsUpdate = true;
        this.shadowStamp = stamp;
      }
    }
    const fog = this.scene.fog as T.FogExp2;
    fog.density = Math.min(0.085, 0.28 / Math.max(1, d)) * zoom;
    if (fog.density > 0.0001) {
      this.nav.camera.far = Math.min(
        this.nav.camera.far,
        Math.max(d * 2.5, 3.6 / fog.density),
      );
      this.nav.camera.updateProjectionMatrix();
    }
    this.gl.setClearColor(0xaccbd0, zoom);
    const submit = performance.now();
    graphics.activity=this.nav.flight?"camera":"world";graphics.scope=this.mode;
    if(!this.customRender?.(dt))this.gl.render(this.scene, this.nav.camera);
    this.renderMs = performance.now() - submit;
    const sample=observeFrame(now);
    if(sample){const ratio=this.resolution.sample(sample.fps,sample.seconds);if(ratio!==undefined)this.gl.setPixelRatio(ratio);}
    this.onFrame?.();
  };
}
