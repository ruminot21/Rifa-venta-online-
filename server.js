require("dotenv").config();
const express=require("express");
const path=require("path");
const crypto=require("crypto");
const {MercadoPagoConfig,Preference,Payment}=require("mercadopago");

const app=express();
app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

const PORT=process.env.PORT||3000;
const BASE_URL=process.env.BASE_URL||`http://localhost:${PORT}`;
const client=new MercadoPagoConfig({accessToken:process.env.MP_ACCESS_TOKEN});

let raffle={
  raffleName:process.env.RAFFLE_NAME||"Rifa Online",
  totalNumbers:Number(process.env.TOTAL_NUMBERS||100),
  ticketValue:Number(process.env.TICKET_VALUE||5000)
};

/*
 Demo funcional:
 - reservas y órdenes viven en memoria.
 - para producción reemplazar reservations/orders por Firestore/PostgreSQL.
*/
const orders=new Map();
const reservations=new Map();

app.get("/api/raffle",(req,res)=>res.json(raffle));

app.get("/api/numbers",(req,res)=>{
  const sold=[];
  for(const o of orders.values()) if(o.status==="approved") sold.push(...o.numbers);
  res.json([...new Set(sold)].sort((a,b)=>a-b));
});

app.post("/api/create-preference",async(req,res)=>{
  try{
    const {name,email,phone,rut,numbers}=req.body;
    if(!name||!email||!Array.isArray(numbers)||!numbers.length) return res.status(400).json({error:"Datos incompletos"});
    const clean=[...new Set(numbers.map(Number))].filter(n=>n>=1&&n<=raffle.totalNumbers);
    if(clean.length!==numbers.length) return res.status(400).json({error:"Número inválido"});

    const sold=new Set();
    for(const o of orders.values()) if(o.status==="approved") o.numbers.forEach(n=>sold.add(n));
    const reserved=new Set();
    for(const r of reservations.values()) if(r.expiresAt>Date.now()) r.numbers.forEach(n=>reserved.add(n));
    const blocked=clean.find(n=>sold.has(n)||reserved.has(n));
    if(blocked) return res.status(409).json({error:`El número ${String(blocked).padStart(3,"0")} ya no está disponible`});

    const orderId=crypto.randomUUID();
    reservations.set(orderId,{numbers:clean,expiresAt:Date.now()+10*60*1000});

    const preference=new Preference(client);
    const result=await preference.create({body:{
      items:[{
        id:orderId,
        title:`${raffle.raffleName} - ${clean.length} número(s)`,
        quantity:1,
        currency_id:"CLP",
        unit_price:clean.length*raffle.ticketValue
      }],
      payer:{name,email,phone:phone?{number:phone}:undefined,identification:rut?{type:"RUT",number:rut}:undefined},
      external_reference:orderId,
      back_urls:{
        success:`${BASE_URL}/resultado.html?estado=success&orden=${orderId}`,
        pending:`${BASE_URL}/resultado.html?estado=pending&orden=${orderId}`,
        failure:`${BASE_URL}/resultado.html?estado=failure&orden=${orderId}`
      },
      notification_url:`${BASE_URL}/api/webhook`,
      auto_return:"approved"
    }});

    orders.set(orderId,{id:orderId,name,email,phone,rut,numbers:clean,total:clean.length*raffle.ticketValue,status:"pending",preferenceId:result.id});
    res.json({init_point:result.init_point,orderId});
  }catch(e){
    console.error(e);
    res.status(500).json({error:"Error creando la preferencia de Mercado Pago"});
  }
});

app.post("/api/webhook",async(req,res)=>{
  res.sendStatus(200);
  try{
    const paymentId=req.body?.data?.id;
    if(!paymentId) return;
    const payment=new Payment(client);
    const p=await payment.get({id:String(paymentId)});
    const orderId=p.external_reference;
    const order=orders.get(orderId);
    if(!order) return;
    order.paymentId=String(paymentId);
    order.status=p.status;
    if(p.status==="approved") reservations.delete(orderId);
  }catch(e){console.error("Webhook:",e.message)}
});

app.get("/api/order/:id",(req,res)=>{
  const o=orders.get(req.params.id);
  if(!o)return res.status(404).json({error:"Orden no encontrada"});
  res.json(o);
});

app.get("/resultado.html",(req,res)=>res.sendFile(path.join(__dirname,"public","resultado.html")));

app.listen(PORT,()=>console.log(`Rifa Mercado Pago: ${BASE_URL}`));
