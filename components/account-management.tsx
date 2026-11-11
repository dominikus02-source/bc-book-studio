"use client";
import {useCallback,useEffect,useRef,useState} from "react";

type Role="EDITOR"|"REVIEWER"|"ADMIN"|"SUPERADMIN";
type User={id:string;email:string;name:string;role:Role;active:boolean};
const roles:Role[]=["EDITOR","REVIEWER","ADMIN"];
async function request(url:string,options?:RequestInit){
 const res=await fetch(url,{cache:"no-store",credentials:"same-origin",...options});
 const payload=await res.json().catch(()=>({error:"Respons server tidak valid"}));
 if(!res.ok)throw new Error(payload.error||`HTTP ${res.status}`);
 return payload;
}
export default function AccountManagement(){
 const [users,setUsers]=useState<User[]>([]);
 const [drafts,setDrafts]=useState<Record<string,User>>({});
 const [status,setStatus]=useState<Record<string,string>>({});
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [deleting,setDeleting]=useState<string|null>(null);
 const [newUser,setNewUser]=useState({email:"",name:"",role:"EDITOR" as Role});
 const timers=useRef<Record<string,ReturnType<typeof setTimeout>>>({});
 const sequence=useRef<Record<string,Promise<void>>>({});
 const revision=useRef<Record<string,number>>({});
 const load=useCallback(async()=>{
   const data=await request("/api/admin/users");
   const list=data.users as User[];
   setUsers(list);setDrafts(Object.fromEntries(list.map(u=>[u.id,{...u}])));
 },[]);
 useEffect(()=>{
   let mounted=true;
   void load().catch(e=>{if(mounted)setError(e.message)}).finally(()=>{if(mounted)setLoading(false)});
   return()=>{mounted=false;Object.values(timers.current).forEach(clearTimeout)};
 },[load]);
 function persist(id:string,next:User,version:number){
   sequence.current[id]=(sequence.current[id]||Promise.resolve()).catch(()=>{}).then(async()=>{
     if(version!==revision.current[id])return;
     setStatus(s=>({...s,[id]:"Menyimpan..."}));
     try{
       const result=await request("/api/admin/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,name:next.name,role:next.role,active:next.active})});
       setUsers(current=>current.map(u=>u.id===id?{...u,...result.user}:u));
       if(version===revision.current[id])setStatus(s=>({...s,[id]:"Tersimpan"}));
     }catch(e){
       if(version===revision.current[id])setStatus(s=>({...s,[id]:e instanceof Error?e.message:"Gagal menyimpan"}));
     }
   });
 }
 function edit(id:string,changes:Partial<User>){
   const next={...drafts[id],...changes};
   setDrafts(current=>({...current,[id]:next}));
   const version=(revision.current[id]||0)+1;revision.current[id]=version;
   clearTimeout(timers.current[id]);
   if(next.name.trim().length<2||next.name.trim().length>120){
     setStatus(s=>({...s,[id]:"Nama harus 2–120 karakter"}));return;
   }
   setStatus(s=>({...s,[id]:"Menunggu autosave..."}));
   timers.current[id]=setTimeout(()=>persist(id,next,version),700);
 }
 function reset(id:string){
   clearTimeout(timers.current[id]);revision.current[id]=(revision.current[id]||0)+1;
   const saved=users.find(u=>u.id===id);
   if(saved)setDrafts(s=>({...s,[id]:{...saved}}));
   setStatus(s=>({...s,[id]:"Perubahan yang belum tersimpan dibatalkan"}));
 }
 async function add(e:React.FormEvent){
   e.preventDefault();if(busy)return;
   setBusy(true);setError("");
   try{
     const result=await request("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(newUser)});
     setNewUser({email:"",name:"",role:"EDITOR"});
     await load();
     if(result.warning)setError(result.warning);
   }catch(e){setError(e instanceof Error?e.message:"Gagal menambah akun")}
   finally{setBusy(false)}
 }
 async function deactivate(user:User){
   if(!window.confirm(`Nonaktifkan ${user.email}? Sesi akun akan dihentikan; data buku tetap disimpan.`))return;
   clearTimeout(timers.current[user.id]);revision.current[user.id]=(revision.current[user.id]||0)+1;
   setDeleting(user.id);setError("");
   try{
     await (sequence.current[user.id]||Promise.resolve()).catch(()=>{});
     await request("/api/admin/users?id="+encodeURIComponent(user.id),{method:"DELETE"});
     await load();
     setStatus(s=>({...s,[user.id]:"Akun dinonaktifkan"}));
   }catch(e){setError(e instanceof Error?e.message:"Gagal menonaktifkan akun")}
   finally{setDeleting(null)}
 }
 return <section style={{maxWidth:1100,margin:"0 auto",padding:"clamp(12px,2vw,28px)"}}>
   <h1>Manajemen Akun</h1>
   <p>SUPERADMIN · Tambah akun, edit nama/role, aktifkan kembali, dan nonaktifkan akun. Perubahan otomatis tersimpan.</p>
   {error&&<p role="alert" style={{color:"var(--danger,#b42318)"}}>{error}</p>}
   <form onSubmit={add} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,alignItems:"end",margin:"24px 0"}}>
    <label>Nama<input required minLength={2} maxLength={120} style={{width:"100%"}} value={newUser.name} onChange={e=>setNewUser(u=>({...u,name:e.target.value}))}/></label>
    <label>Email<input required type="email" style={{width:"100%"}} value={newUser.email} onChange={e=>setNewUser(u=>({...u,email:e.target.value}))}/></label>
    <label>Hak akses<select style={{width:"100%"}} value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value as Role}))}>{roles.map(role=><option key={role}>{role}</option>)}</select></label>
    <button className="primary-button" disabled={busy} type="submit">{busy?"Menyimpan...":"Tambah akun"}</button>
   </form>
   {loading?<p role="status">Memuat akun...</p>:users.length===0?<p>Belum ada akun yang dapat ditampilkan.</p>:null}
   <div style={{display:"grid",gap:12}}>{users.map(u=>{
     const d=drafts[u.id]||u;const protectedAccount=u.role==="SUPERADMIN";
     return <article key={u.id} style={{border:"1px solid var(--border,#d9dee8)",borderRadius:14,padding:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,alignItems:"end"}}>
      <label>Nama<input minLength={2} maxLength={120} style={{width:"100%"}} disabled={protectedAccount||deleting===u.id} value={d.name} onChange={e=>edit(u.id,{name:e.target.value})}/></label>
      <div><small>Email</small><div style={{overflowWrap:"anywhere"}}>{u.email}</div></div>
      <label>Role<select style={{width:"100%"}} disabled={protectedAccount||deleting===u.id} value={d.role} onChange={e=>edit(u.id,{role:e.target.value as Role})}>{protectedAccount&&<option>SUPERADMIN</option>}{roles.map(role=><option key={role}>{role}</option>)}</select></label>
      <label>Status<select style={{width:"100%"}} disabled={protectedAccount||deleting===u.id} value={String(d.active)} onChange={e=>edit(u.id,{active:e.target.value==="true"})}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
       <button type="button" className="secondary-button" disabled={deleting===u.id} onClick={()=>reset(u.id)}>Reset</button>
       {!protectedAccount&&u.active&&<button type="button" className="secondary-button" disabled={deleting===u.id} onClick={()=>void deactivate(u)}>{deleting===u.id?"Menonaktifkan...":"Nonaktifkan"}</button>}
       <small role="status" style={{width:"100%"}}>{status[u.id]||"Tersimpan"}</small>
      </div>
     </article>;
   })}</div>
 </section>;
}
