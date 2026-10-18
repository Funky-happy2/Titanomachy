import http from 'node:http';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const PORT=process.env.PORT||3000;
const pool=process.env.DATABASE_URL?new pg.Pool({connectionString:process.env.DATABASE_URL,max:5}):null;
if(pool)await pool.query('create table if not exists saves(id text primary key,data jsonb not null,updated_at timestamptz not null default now())');
else console.warn('DATABASE_URL not set — cloud saves disabled');

const FILES={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/game.js':['game.js','text/javascript']};
const send=(res,code,body,type='application/json')=>{res.writeHead(code,{'content-type':type,'cache-control':'no-cache'});res.end(body)};

http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://x'),m=url.pathname.match(/^\/api\/save\/([\w-]{8,64})$/);
 if(m){if(!pool)return send(res,503,'{"error":"no database"}');
  if(req.method=='GET'){const r=await pool.query('select data from saves where id=$1',[m[1]]);return r.rows[0]?send(res,200,JSON.stringify(r.rows[0].data)):send(res,200,'null')}
  if(req.method=='PUT'){let body='';for await(const c of req){body+=c;if(body.length>100000)return send(res,413,'{"error":"too large"}')}
   const data=JSON.parse(body);if(typeof data!='object'||!data)return send(res,400,'{"error":"bad save"}');
   await pool.query('insert into saves(id,data,updated_at) values($1,$2,now()) on conflict(id) do update set data=$2,updated_at=now()',[m[1],data]);return send(res,204,'')}
  return send(res,405,'{"error":"method"}')}
 if(url.pathname=='/favicon.ico')return send(res,204,'','image/x-icon');
 if(url.pathname=='/healthz')return send(res,200,'ok','text/plain');
 const f=FILES[url.pathname];if(!f)return send(res,404,'not found','text/plain');
 send(res,200,await readFile(new URL(f[0],import.meta.url)),f[1]);
}catch(e){console.error(e);send(res,500,'{"error":"server"}')}}).listen(PORT,()=>console.log('Titanomachy on :'+PORT));
