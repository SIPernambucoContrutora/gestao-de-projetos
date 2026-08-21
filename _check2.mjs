import { neon } from '@neondatabase/serverless';
const sql = neon('postgresql://neondb_owner:npg_J7lT8vHGDdbV@ep-billowing-star-ac7z2i9d-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
const r = await sql`select * from historico_alteracoes where campo = 'status' order by criado_em desc limit 30`;
console.log(JSON.stringify(r, null, 2));
const total = await sql`select count(*) from itens_projeto`;
console.log('total itens', JSON.stringify(total));
