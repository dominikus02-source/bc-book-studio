"use client";
export async function prepareImageUpload(file:File){
 if(!["image/png","image/jpeg"].includes(file.type)||file.size>12000000||file.size<32)throw Error("Gunakan PNG/JPEG maksimum 12 MB.");
 const bitmap=await createImageBitmap(file);
 try{
  let scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const mime=file.type;
  for(let attempt=0;attempt<8;attempt++){
   const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext("2d");if(!ctx)throw Error("Browser tidak dapat menyiapkan gambar.");
   ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL(mime,Math.max(.45,.9-attempt*.07)).split(",")[1];
   if(Math.ceil(data.length*3/4)<=540000)return {data,mime,name:(file.name.replace(/\.[^.]+$/,"").slice(0,140)+(mime==="image/png"?".png":".jpg"))};
   scale*=.8;
  }throw Error("Gambar masih terlalu besar; gunakan resolusi lebih kecil.");
 }finally{bitmap.close()}
}
