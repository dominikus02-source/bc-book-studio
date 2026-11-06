"use client";
import {useEffect,useState} from "react";
import {usePathname,useSearchParams} from "next/navigation";
import BreadcrumbTrail from "./breadcrumb-trail";
import {studioBreadcrumbs,type BookDetails} from "../../lib/navigation/breadcrumbs";
import styles from "./breadcrumb-trail.module.css";

/** Single layout-owned breadcrumb with no portal, observer or DOM mutation. */
export default function RouteBreadcrumbs(){
 const pathname=usePathname()||"/";
 const params=useSearchParams();
 const [details,setDetails]=useState<BookDetails>(null);
 useEffect(()=>{
   setDetails(null);
 },[pathname]);
 useEffect(()=>{
  const update=(event:Event)=>setDetails((event as CustomEvent<BookDetails>).detail);
  window.addEventListener("bc-breadcrumb-book",update);
  return ()=>window.removeEventListener("bc-breadcrumb-book",update);
 },[]);
 const items=studioBreadcrumbs(pathname,params,details);
 if(pathname!=="/studio" || items.length<2)return null;
 return <div className={styles.host} data-breadcrumb-host="true"><BreadcrumbTrail items={items}/></div>;
}
