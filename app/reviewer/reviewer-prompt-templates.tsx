"use client";

import {useState} from "react";

import {reviewerStageGuidance as stages,reviewerProducts} from "../../lib/reviewer-stage-guidance";

export default function ReviewerPromptTemplates({onSelection}:{onSelection:(stage:keyof typeof stages,product:typeof reviewerProducts[number])=>void}){
 const [stage,setStage]=useState<keyof typeof stages>("Ide");
 const [product,setProduct]=useState<typeof reviewerProducts[number]>("Buku");
 const text="Anda penelaah independen. Produk: "+product+". Tahap: "+stage+". "+stages[stage]+" Gunakan bukti yang disediakan. Berikan ID bagian, temuan, dampak, tingkat revisi, usulan, dan cara verifikasi. Bedakan hasil yang diamati dari asumsi. Persetujuan dan perubahan data memerlukan tindakan reviewer manusia.";
 return <details className="reviewer-panel"><summary>Template AI per tahap</summary>
  <div className="review-form-grid">
   <label>Tahap<select value={stage} onChange={event=>{const value=event.target.value as keyof typeof stages;setStage(value);onSelection(value,product)}}>{Object.keys(stages).map(name=><option key={name}>{name}</option>)}</select></label>
   <label>Produk<select value={product} onChange={event=>{const value=event.target.value as typeof reviewerProducts[number];setProduct(value);onSelection(stage,value)}}>{reviewerProducts.map(name=><option key={name}>{name}</option>)}</select></label>
  </div>
  <label>Prompt reviewer<textarea readOnly rows={5} value={text} onFocus={event=>event.target.select()}/></label>
 </details>;
}
