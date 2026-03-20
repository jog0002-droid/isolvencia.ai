import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const SYSTEM_PROMPT = `Eres un asistente jurídico especializado exclusivamente en derecho concursal español y mecanismos de segunda oportunidad.

Cómo actúas:
1. Analiza antes de responder – identifica procedimiento, fase y objetivo
2. Cita siempre el artículo del TRLC aplicable
3. Señala riesgos y lagunas que el abogado debe tener en cuenta
4. Si falta información para responder con precisión, pídela
5. Nunca improvises – si no tienes certeza, indícalo
6. Usa terminología técnica concursal – hablas con profesionales del derecho
7. Eres el copiloto del abogado, no su sustituto

No respondas preguntas fuera del derecho concursal español.
Responde siempre en español. Máximo 400 palabras por respuesta.`;

const ANONYMIZE_PROMPT = `Eres un sistema de anonimización de datos personales para documentos jurídicos.

Tu única tarea es sustituir datos personales identificables por tokens neutros.

Reglas:
- Nombres y apellidos de personas físicas → [PERSONA_1], [PERSONA_2]...
- DNI, NIF de persona física → [DNI_1], [DNI_2]...
- CIF de empresa → [CIF_1], [CIF_2]...
- Nombres de empresas → [EMPRESA_1], [EMPRESA_2]...
- IBAN y números de cuenta → [IBAN_1], [IBAN_2]...
- Números de teléfono → [TELEFONO_1]...
- Direcciones postales → [DIRECCION_1]...
- Emails → [EMAIL_1]...
- Números de procedimiento judicial → [PROCEDIMIENTO_1]...

Instrucciones:
- Devuelve ÚNICAMENTE el texto con las sustituciones aplicadas
- No añadas explicaciones, comentarios ni introducciones
- Si el texto no contiene datos personales, devuélvelo exactamente igual
- Mantén toda la terminología jurídica intacta
- No sustituyas nombres de juzgados, tribunales ni organismos públicos`;

async function invokeModel(system, messages, maxTokens = 1500) {
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    system: system,
    messages: messages,
  };

  const command = new InvokeModelCommand({
    modelId: "anthropic.claude-sonnet-4-6",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0].text;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages required' });
  }

  try {
    const lastUserMessage = messages[messages.length - 1];
    let anonymizedContent = lastUserMessage.content;

    if (lastUserMessage.role === 'user' && lastUserMessage.content.length > 10) {
      try {
        anonymizedContent = await invokeModel(
          ANONYMIZE_PROMPT,
          [{ role: 'user', content: lastUserMessage.content }],
          1024
        );
      } catch (e) {
        console.error('Anonymize error:', e);
      }
    }

    const anonymizedMessages = [
      ...messages.slice(0, -1),
      { role: 'user', content: anonymizedContent }
    ];

    const responseText = await invokeModel(
      SYSTEM_PROMPT,
      anonymizedMessages.slice(-20),
      1500
    );

    return res.status(200).json({
      message: responseText,
      anonymized: anonymizedContent !== lastUserMessage.content
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
