// Classroom disclosures affect only the explanation overlay, never the scientific state.
const body=document.body;
export const channels={labels:"Beschriftungen",terms:"Fachbegriff",phase:"Phase",cause:"Ursache",effects:"Folgen"};
export type Channel=keyof typeof channels;
const granted=new Set<Channel>(),objects=new Set<string>();
let revision=0;
const candidates=new Set<string>();
export function beginCandidates(){candidates.clear();}
export function disclosure(){return {channels:[...granted],names:[...objects]};}
export function restoreDisclosure(data?:ReturnType<typeof disclosure>){
 resetReveals();if(!data)return;
 for(const c of Array.isArray(data.channels)?data.channels:[])if(Object.hasOwn(channels,c))granted.add(c);
 for(const id of Array.isArray(data.names)?data.names:[])if(typeof id==="string")objects.add(id);publish();
}
let chosen:{id:string;text:string}|undefined;
export function chosenReading(){return chosen;}
export function resetReveals(){granted.clear();objects.clear();chosen=undefined;candidates.clear();delete body.dataset.chooseObject;publish();}
function publish(){
 body.dataset.reveal=String(++revision);
 for(const field of Object.keys(channels) as Channel[])body.classList.toggle("show-"+field,granted.has(field));
 body.classList.toggle("show-some-labels",objects.size>0);
}
export function reveal(field:Channel){if(granted.has(field))granted.delete(field);else granted.add(field);publish();}
export function revealAll(){for(const field of Object.keys(channels) as Channel[])granted.add(field);publish();}
export function nextLabel(){const id=[...candidates].find(id=>!objects.has(id));if(id){objects.add(id);publish();}}
export function claimObject(id:string,text=""){if(!body.hasAttribute("data-choose-object"))return false;delete body.dataset.chooseObject;objects.add(id);chosen={id,text};publish();return true;}
export function allowsLabel(id:string,_index=9999){candidates.add(id);return !body.classList.contains("observing")||granted.has("labels")||objects.has(id);}
export function disclosed(field:Channel){return granted.has(field);}
