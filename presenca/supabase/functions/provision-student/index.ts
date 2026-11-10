// Administrador autenticado provisiona alunos matriculados com senha única.
// Nunca mover a chave de serviço para o cliente GitHub Pages.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const appOrigin = 'https://doquinha771.github.io';
const cors = {
  'Access-Control-Allow-Origin': appOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const response = (body: Record<string, unknown>, status=200) => Response.json(body, {status, headers:{...cors,'Cache-Control':'no-store'}});
const SCHOOL_EMAIL = /^[0-9]{7,16}(sp)?@al\.educacao\.sp\.gov\.br$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (req.method !== 'POST') return response({error:'Método não permitido.'},405);
  if (!url || !serviceKey || !publicKey) return response({error:'Serviço de contas não configurado.'},503);
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!token) return response({error:'Sessão necessária.'},401);
  try {
    // Confirma a identidade com o Auth e consulta o cargo REAL no banco, nunca user_metadata.
    const {data:auth,error:authError} = await admin.auth.getUser(token);
    if (authError || !auth.user) return response({error:'Sessão inválida.'},401);
    const {data:operator,error:staffError} = await admin.from('profiles')
      .select('id,role,verified,active,archived_at').eq('id',auth.user.id).maybeSingle();
    if (staffError || !operator || !['admin','secretaria'].includes(operator.role)
      || !operator.verified || !operator.active || operator.archived_at) {
      return response({error:'Somente equipe institucional autorizada.'},403);
    }
    const payload = await req.json().catch(() => ({}));
    const enrollmentId = typeof payload.enrollment_id==='string'?payload.enrollment_id:'';
    if (!/^[a-f0-9-]{36}$/i.test(enrollmentId)) return response({error:'Matrícula inválida.'},400);
    const {data:e,error:enrollmentError} = await admin.from('school_enrollments')
      .select('id,email,ra,full_name,birth_date,active,profile_id,class_id')
      .eq('id',enrollmentId).maybeSingle();
    if (enrollmentError || !e || !e.active || !SCHOOL_EMAIL.test(e.email) ||
        e.email.toLowerCase().split('@')[0]!==e.ra.toLowerCase())
      return response({error:'Matrícula inexistente ou não autorizada.'},404);
    if (e.profile_id) return response({linked:true});
    const {data:classData,error:classError} = await admin.from('school_classes')
      .select('grade,name,active').eq('id',e.class_id).single();
    if (classError || !classData?.active) return response({error:'Turma indisponível.'},409);
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const temporaryPassword = Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    const {data:created,error:createError} = await admin.auth.admin.createUser({
      email:e.email, password:temporaryPassword, email_confirm:true,
      user_metadata:{full_name:e.full_name,ra:e.ra,birth_date:e.birth_date,
        grade:`${classData.grade} • ${classData.name}`},
    });
    if (createError || !created.user) {
      // Um outro operador pode ter criado a conta durante a requisição.
      const {data:latest} = await admin.from('school_enrollments').select('profile_id').eq('id',enrollmentId).maybeSingle();
      if (latest?.profile_id) return response({linked:true});
      return response({error:'Não foi possível criar a conta. Confira se este e-mail já pertence a outra conta.'},409);
    }
    const {data:linked,error:linkError} = await admin.from('school_enrollments')
      .select('profile_id').eq('id',enrollmentId).maybeSingle();
    if (linkError || linked?.profile_id !== created.user.id) {
      // Não devolve senha de conta sem autorização efetiva. Não apaga auth.users às cegas.
      return response({error:'A conta foi criada, mas a vinculação escolar precisa ser conferida pela Direção.'},409);
    }
    return response({email:e.email,temporaryPassword});
  } catch {
    return response({error:'Não foi possível criar o acesso. Verifique o cadastro da matrícula.'},500);
  }
});
