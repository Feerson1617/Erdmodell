export type Activity="load"|"warmup"|"cached"|"still"|"camera"|"animation"|"world";
export class RenderCadence{
  frames=0;callbacks=0;
  totals:Record<Activity,number>={load:0,warmup:0,cached:0,still:0,camera:0,animation:0,world:0};
  grade=1;changes:{at:number;scope:string;from:number;to:number;fps:number}[]=[];
  private scope="";private last=0;private previousActive=false;private until=0;
  private ms=0;private count=0;private fast=0;private slow=0;
  private grades=new Map<string,number>();
  private reset(){this.ms=this.count=this.fast=this.slow=0;this.previousActive=false;}
  frame(now:number,activity:Activity,scope:string,automatic:boolean){
    this.callbacks++;if(activity!=="cached")this.frames++;
    if(scope!==this.scope){
      this.scope=scope;this.grade=this.grades.get(scope)??1;this.until=now+1400;this.reset();
    }
    let active=["animation","camera","world"].includes(activity);
    if(active&&now<this.until){activity="warmup";active=false;}
    this.totals[activity]++;
    const gap=now-this.last;this.last=now;const continuous=active&&this.previousActive;this.previousActive=active;
    if(!active){if(activity==="load"||activity==="warmup")this.reset();return;}
    if(!continuous||gap<=0)return;
    // Cap the influence of a single stall. Repeated stalls still yield slow windows.
    this.ms+=Math.min(gap,350);this.count++;if(this.ms<2500)return;
    const seconds=this.ms/1000,fps=this.count/seconds;this.ms=this.count=0;
    this.fast=fps>51?this.fast+1:0;this.slow=fps<29?this.slow+1:0;
    const from=this.grade;
    if(automatic&&this.fast>=3&&from<2)this.grade++;
    else if(automatic&&this.slow>=2&&from>0)this.grade--;
    if(from!==this.grade){
      this.grades.set(scope,this.grade);
      if(this.grades.size>24)this.grades.delete(this.grades.keys().next().value!);
      this.changes.push({at:now,scope,from,to:this.grade,fps});if(this.changes.length>128)this.changes.shift();
      this.until=now+3200;this.reset();
    }
    return {fps,seconds};
  }
  restart(){this.until=this.last+1400;this.reset();}
}
