export type ActiveAiModel={
  status:"loading"|"ready"|"missing"|"error";
  configured:boolean;
  label:string;
  model:string;
  provider:string;
};

type StatusPayload={
  configured?:boolean;
  provider?:{label?:string;model?:string;provider?:string;name?:string}|null;
  ai?:{configured?:boolean;model?:string|null;label?:string|null;provider?:string|null};
};

export function parseActiveAiPayload(data:unknown):Omit<ActiveAiModel,"status">{
  const payload=(data??{}) as StatusPayload;
  const row=payload.provider;
  if(payload.configured&&row&&(row.model||row.label)){
    return {
      configured:true,
      label:String(row.label||"").trim(),
      model:String(row.model||"").trim(),
      provider:String(row.provider||row.name||"").trim()
    };
  }
  if(payload.ai?.configured&&payload.ai.model){
    return {
      configured:true,
      label:String(payload.ai.label||"").trim(),
      model:String(payload.ai.model||"").trim(),
      provider:String(payload.ai.provider||"").trim()
    };
  }
  return {configured:false,label:"",model:"",provider:""};
}

export function formatActiveModel(state:ActiveAiModel):string{
  if(state.status==="loading")return "Memuat model aktif…";
  if(state.configured&&(state.label||state.model)){
    return [state.label,state.model].filter(Boolean).join(" · ");
  }
  if(state.status==="error")return "Status model belum dapat dibaca. Muat ulang halaman, lalu periksa Pengaturan.";
  return "Belum dikonfigurasi / periksa Pengaturan";
}
