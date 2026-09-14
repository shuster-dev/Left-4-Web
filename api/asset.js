const ASSETS={
  environment:'https://cdn.3dassets.dev/assets/32711/v1/model.glb',
  survivor:'https://cdn.3dassets.dev/assets/32901/v1/model.glb',
  runner:'https://cdn.3dassets.dev/assets/32707/v1/model.glb',
  bloated:'https://cdn.3dassets.dev/assets/32706/v1/model.glb',
  stalker:'https://cdn.3dassets.dev/assets/32708/v1/model.glb'
};
export default async function handler(req,res){
  const name=String(req.query?.name||''); const url=ASSETS[name];
  if(!url){res.status(404).json({error:'unknown_asset'});return}
  try{
    const upstream=await fetch(url,{headers:{'User-Agent':'Hobile-Outbreak/CombatPolish-V5'}});
    if(!upstream.ok){res.status(502).json({error:'upstream_'+upstream.status});return}
    const buf=Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type','model/gltf-binary');
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin','*');
    res.status(200).send(buf);
  }catch(err){res.status(500).json({error:'asset_proxy_failed',message:String(err?.message||err)})}
}
