"use client";
import {useEffect} from "react";
import {useSearchParams} from "next/navigation";
export function useBookSelection(){
 const params=useSearchParams();
 const id=params.get("book")||"",chapter=params.get("chapter")||"";
 const selectBook=(value:string)=>{
  const url=new URL(window.location.href);
  if(value)url.searchParams.set("book",value);else url.searchParams.delete("book");
  url.searchParams.delete("chapter");
  if(url.href!==window.location.href)window.history.pushState(window.history.state,"",url);
 };
 const selectChapter=(value:string)=>{
  const url=new URL(window.location.href);
  if(value)url.searchParams.set("chapter",value);else url.searchParams.delete("chapter");
  if(url.href!==window.location.href)window.history.pushState(window.history.state,"",url);
 };
 return [id,selectBook,chapter,selectChapter] as const;
}
export function useBookBreadcrumbDetails(book:{id:string;title:string;chapters:{id:string;title:string}[]}|undefined,chapterId:string){
 useEffect(()=>{
  const chapter=book?.chapters.find(item=>item.id===chapterId);
  window.dispatchEvent(new CustomEvent("bc-breadcrumb-book",{detail:book?{id:book.id,title:book.title,chapter}:null}));
 },[book,chapterId]);
}
