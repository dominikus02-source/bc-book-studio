"use client";
import {useCallback,useEffect,useState} from "react";
import {type ActiveAiModel,parseActiveAiPayload} from "../lib/active-ai-model";
export type {ActiveAiModel};
export {formatActiveModel} from "../lib/active-ai-model";

function empty():ActiveAiModel{
  return {status:"loading",configured:false,label:"",model:"",provider:""};
}

export function useActiveAiModel(){
  const [state,setState]=useState<ActiveAiModel>(empty);
  const load=useCallback(async(signal?:AbortSignal)=>{
    async function read(url:string){
      const response=await fetch(url,{cache:"no-store",signal,credentials:"same-origin"});
      if(!response.ok)throw Error("HTTP_"+response.status);
      return parseActiveAiPayload(await response.json());
    }
    try{
      try{
        const primary=await read("/api/studio/ai-form");
        if(primary.configured){
          setState({status:"ready",...primary});
          return;
        }
      }catch{
        /* Fall back to /api/studio/status, which any signed-in role can read. */
      }
      const fallback=await read("/api/studio/status");
      setState({status:fallback.configured?"ready":"missing",...fallback});
    }catch(error){
      if((error as {name?:string}).name==="AbortError")return;
      setState(current=>({...current,status:current.configured?"ready":"error"}));
    }
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void load(controller.signal);
    const refresh=()=>void load();
    window.addEventListener("bc-provider-updated",refresh);
    return()=>{controller.abort();window.removeEventListener("bc-provider-updated",refresh);};
  },[load]);
  return {...state,reload:load};
}
