(function(){
 const URL="https://dpffgbdazsjwxxdggugb.supabase.co";
 const KEY="sb_publishable_H9Y4zUGaoAf2_IQOr_GaIA_qGXk3yRB";
 const C=window.OutbreakCore;
 class NetRoom{
  constructor(){
   this.id=crypto.randomUUID?.()||("p-"+Math.random().toString(36).slice(2));
   this.name="Survivor-"+this.id.slice(0,4).toUpperCase();
   this.creator=false;this.joinedAt=Date.now();this.room=null;this.client=null;this.channel=null;
   this.players=[];this.hostId=null;this.handlers={};this.connected=false;
  }
  on(ev,fn){(this.handlers[ev]||=[]).push(fn);return this}
  emit(ev,d){for(const fn of this.handlers[ev]||[])try{fn(d)}catch(e){console.error(e)}}
  isHost(){return this.id===this.hostId}
  presence(){return{id:this.id,name:this.name,creator:this.creator,joinedAt:this.joinedAt,ready:true}}
  async connect(room,{creator=false}={}){
   if(!window.supabase?.createClient)throw new Error("Supabase client library did not load.");
   await this.disconnect();
   this.room=String(room||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5);
   if(this.room.length!==5)throw new Error("Invalid room code.");
   this.creator=creator;this.joinedAt=Date.now();
   this.client=window.supabase.createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   this.channel=this.client.channel("outbreak:"+this.room,{config:{presence:{key:this.id},broadcast:{self:false,ack:false}}});
   const events=["state","shot","world","damage","revive","match_start","stage_clear","system"];
   this.channel.on("presence",{event:"sync"},()=>this.sync()).on("presence",{event:"join"},()=>this.sync()).on("presence",{event:"leave"},()=>this.sync());
   for(const ev of events)this.channel.on("broadcast",{event:ev},m=>this.emit(ev,m.payload));
   return new Promise((resolve,reject)=>{
    let done=false;const timer=setTimeout(()=>{if(!done){done=true;reject(new Error("Realtime connection timed out."))}},12000);
    this.channel.subscribe(async status=>{
     this.emit("status",status);
     if(status==="SUBSCRIBED"&&!done){done=true;clearTimeout(timer);this.connected=true;await this.channel.track(this.presence());this.sync();resolve(this)}
     else if((status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED")&&!done){done=true;clearTimeout(timer);reject(new Error("Realtime "+status))}
    });
   });
  }
  sync(){
   if(!this.channel)return;
   this.players=C.flattenPresence(this.channel.presenceState());this.hostId=C.electHost(this.players);
   this.emit("presence",{players:this.players,hostId:this.hostId});
  }
  async rename(name){
   this.name=(name||this.name).trim().slice(0,16)||this.name;
   if(this.channel)await this.channel.track(this.presence());
  }
  send(event,payload){if(!this.channel)return Promise.resolve();return this.channel.send({type:"broadcast",event,payload:{...payload,from:this.id,t:Date.now()}})}
  async disconnect(){
   this.connected=false;
   try{if(this.channel)await this.channel.untrack()}catch{}
   try{if(this.client&&this.channel)await this.client.removeChannel(this.channel)}catch{}
   this.client=null;this.channel=null;this.players=[];this.hostId=null;
  }
 }
 window.OutbreakNetRoom=NetRoom;
})();