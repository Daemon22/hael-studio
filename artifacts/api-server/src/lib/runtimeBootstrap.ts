export const RUNTIME_PROVENANCE_BOOTSTRAP = String.raw`(function(){
  var c=window.__HAEL_RUNTIME_PROVENANCE__;
  if(!c||typeof c.callbackUrl!=="string"||typeof c.capability!=="string"||!Array.isArray(c.artifacts))return;
  var sequence=0;
  var streamId=window.crypto&&window.crypto.randomUUID?window.crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
  function report(eventType,runtimeId,artifactPath,artifactHash,detail){
    fetch(c.callbackUrl,{method:"POST",keepalive:true,headers:{"content-type":"application/json",authorization:"Bearer "+c.capability},body:JSON.stringify({streamId:streamId,sequence:sequence++,eventType:eventType,runtimeId:runtimeId,artifactPath:artifactPath,artifactHash:artifactHash,detail:String(detail||"").slice(0,1000)})}).catch(function(){});
  }
  window.__HAEL_REPORT_RUNTIME__=function(eventType,runtimeId,artifactPath,artifactHash,detail){report(eventType,runtimeId,artifactPath,artifactHash,detail);};
  var entries=c.artifacts.filter(function(a){return a&&typeof a.path==="string"&&typeof a.sha256==="string"&&Array.isArray(a.runtimeIds)&&a.runtimeIds.length;});
  function first(){if(!entries.length)return null;for(var i=0;i<entries.length;i++){if(entries[i].runtimeIds.length)return {entry:entries[i],runtimeId:entries[i].runtimeIds[0]};}return null;}
  function emit(type,detail){var item=first();if(item)report(type,item.runtimeId,item.entry.path,item.entry.sha256,detail);}
  window.addEventListener("error",function(e){emit("runtime_error",e.message||"Unhandled browser error");});
  window.addEventListener("unhandledrejection",function(e){emit("runtime_error",String(e.reason||"Unhandled promise rejection"));});
  window.addEventListener("pagehide",function(){emit("lifecycle","Preview page hidden or closing");});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")emit("lifecycle","Preview page became hidden");});
  window.addEventListener("hael:runtime",function(e){var d=e.detail||{};var item=entries.find(function(a){return a.runtimeIds.indexOf(d.runtimeId)>=0;});if(item)report(d.eventType,d.runtimeId,d.artifactPath||item.path,d.artifactHash||item.sha256,d.detail);});
  emit("lifecycle","Preview runtime started");
})();`;
