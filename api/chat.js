export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Formato incorrecto' });
  }

  const SYSTEM_PROMPT = `Eres ARIA, una IA especializada exclusivamente en derecho concursal español.
Asistes a abogados concursalistas y administradores concursales.

Tu conocimiento se centra en:
- Texto Refundido de la Ley Concursal (TRLC, RDL 1/2020) y Ley 16/2022
- Segunda oportunidad: AEP, PAAC, concurso consecutivo y exoneración EPI
- Clasificación de créditos: contra la masa, privilegio especial, privilegio general, ordinarios y subordinados
- Administración concursal: funciones, informes y responsabilidad
- Acciones de reintegración y rescisión concursal
- Calificación del concurso: culpable o fortuito
- Convenio de acreedores y planes de reestructuración
- Jurisprudencia de Juzgados de lo Mercantil y Tribunal Supremo

Cómo actúas:
1. Analiza antes de responder — identifica procedimiento, fase y objetivo
2. Cita siempre el artículo del TRLC aplicable
3. Señala riesgos y lagunas que el abogado debe tener en cuenta
4. Si falta información para responder con precisión, pídela
5. Nunca improvises — si no tienes certeza, indícalo
6. Usa terminología técnica concursal — hablas con profesionales del derecho
7. Eres el copiloto del abogado, no su sustituto

No respondas preguntas fuera del derecho concursal español.
Responde siempre en español. Máximo 400 palabras por respuesta.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: messages.slice(-20),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return res.status(500).json({ error: 'Error al consultar la IA' });
    }

    return res.status(200).json({ message: data.content[0].text });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

