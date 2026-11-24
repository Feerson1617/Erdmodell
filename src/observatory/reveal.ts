// Classroom disclosures affect only the explanation overlay, never the scientific state.
const body=document.body;
export const channels={labels:"Beschriftungen",terms:"Fachbegriff",phase:"Phase",cause:"Ursache",effects:"Folgen"};
export type Channel=keyof typeof channels;
const granted=new Set<Channel>(),objects=new Set<string>();
let count=0,revision=0;
let chosen:{id:string;text:string}|undefined;
export function chosenReading(){return chosen;}
export function resetReveals(){granted.clear();objects.clear();chosen=undefined;count=0;delete body.dataset.chooseObject;publish();}
function publish(){
 body.dataset.reveal=String(++revision);
 for(const field of Object.keys(channels) as Channel[])body.classList.toggle("show-"+field,granted.has(field));
 body.classList.toggle("show-some-labels",count>0||objects.size>0);
}
export function reveal(field:Channel){if(granted.has(field))granted.delete(field);else granted.add(field);publish();}
export function revealAll(){for(const field of Object.keys(channels) as Channel[])granted.add(field);publish();}
export function nextLabel(){count++;publish();}
export function claimObject(id:string,text=""){if(!body.hasAttribute("data-choose-object"))return false;delete body.dataset.chooseObject;objects.add(id);chosen={id,text};publish();return true;}
export function allowsLabel(id:string,index=9999){return !body.classList.contains("observing")||granted.has("labels")||index<count||objects.has(id);}
export function disclosed(field:Channel){return granted.has(field);}
