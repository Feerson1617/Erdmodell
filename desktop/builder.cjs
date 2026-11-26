const {readFileSync} = require("node:fs");
module.exports = {
  appId: "de.georisiko.observatorium", productName: "GeoRisiko",
  electronVersion: require("../package.json").devDependencies.electron,
  directories: {app:readFileSync(".scratch/desktop-stage.txt","utf8"),output:"artifacts/macos",buildResources:"desktop"},
  files: ["dist/**/*","desktop/*.cjs","package.json"], asar: true, npmRebuild: false,
  mac: { minimumSystemVersion:"13.0", category:"public.app-category.education", icon:"desktop/GeoRisiko.png", identity:"-", notarize:false,
    hardenedRuntime:true, target:["dmg","zip"], artifactName:"GeoRisiko-G6.8.2-macOS-arm64-app.${ext}" },
  dmg: { title:"GeoRisiko", artifactName:"GeoRisiko-G6.8.2-macOS-arm64.dmg", sign:false,
    contents:[{x:150,y:135},{x:418,y:135,type:"link",path:"/Applications"}] },
  forceCodeSigning: true, publish: null
};
