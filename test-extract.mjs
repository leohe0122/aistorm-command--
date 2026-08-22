const url = process.env.BUILT_IN_FORGE_API_URL + '/v1/chat/completions';
const key = process.env.BUILT_IN_FORGE_API_KEY;
const body = {
  model: 'gpt-5',
  max_completion_tokens: 4096,
  messages: [
    {role:'system',content:'你是拜访后作战引导助手。从记录中提取可验证事实。按JSON Schema返回。'},
    {role:'user',content:'客户：香港电讯\n日期：2026-08-19\n参会人：Vivian、王宇辉、Marcos\n\n【SAM记录】\n- Marcos不反对年底签单\n- Felix的安全架构审批是关键卡点\n\n按JSON Schema返回8区块信号。'}
  ],
  response_format:{type:'json_schema',json_schema:{name:'full_meeting_signals',strict:true,schema:{type:'object',properties:{meddpicc:{type:'array',items:{type:'object',properties:{dimension:{type:'string'},suggestedScore:{type:'number'},evidence:{type:'string'}},required:['dimension','suggestedScore','evidence'],additionalProperties:false}},contacts:{type:'array',items:{type:'object',properties:{name:{type:'string'},role:{type:'string'},stance:{type:'string'}},required:['name','role','stance'],additionalProperties:false}},competitors:{type:'array',items:{type:'object',properties:{name:{type:'string'},signal:{type:'string'}},required:['name','signal'],additionalProperties:false}},timeline:{type:'array',items:{type:'object',properties:{event:{type:'string'},date:{type:'string'}},required:['event','date'],additionalProperties:false}},threeWhy:{type:'object',properties:{whyAnything:{type:'string'},whyUs:{type:'string'},whyNow:{type:'string'}},required:['whyAnything','whyUs','whyNow'],additionalProperties:false},winFactors:{type:'object',properties:{pain:{type:'string'},power:{type:'string'},champion:{type:'string'},value:{type:'string'},control:{type:'string'}},required:['pain','power','champion','value','control'],additionalProperties:false},nextBestAction:{type:'string'},meetingSummary:{type:'string'}},required:['meddpicc','contacts','competitors','timeline','threeWhy','winFactors','nextBestAction','meetingSummary'],additionalProperties:false}}}
};
const res = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify(body)});
console.log('Status:', res.status);
const d = await res.json();
console.log('finishReason:', d.choices?.[0]?.finish_reason);
console.log('content length:', d.choices?.[0]?.message?.content?.length);
console.log('content preview:', d.choices?.[0]?.message?.content?.slice(0, 300));
