// 로컬 전용: 음식 이미지 시험 생성 (Workers AI 무료 사용량). 배포하지 않음
export default {
  async fetch(req, env) {
    const u = new URL(req.url), prompt = u.searchParams.get('p') || '', seed = +(u.searchParams.get('s') || 0) || undefined;
    const model = u.searchParams.get('m') || '@cf/black-forest-labs/flux-1-schnell';
    const r = await env.AI.run(model, model.includes('flux') ? { prompt, steps: 8 } : { prompt, width: 768, height: 768 });
    const b64 = r.image;
    return new Response(Uint8Array.from(atob(b64), c => c.charCodeAt(0)), { headers: { 'content-type': 'image/jpeg' } });
  },
};
