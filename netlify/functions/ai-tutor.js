import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { fileName, userQuestion, chatHistory } = await req.json();

    const { data: fileData, error: downloadError } = await supabase
     .storage
     .from('jegyzetek')
     .download(fileName);

    if (downloadError) throw downloadError;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const pdfBuffer = await fileData.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

    const systemPrompt = `Te egy türelmes egyetemi tutor vagy. A feltöltött jegyzet alapján kérdezz a diáktól. Ne magyarázz, hanem kérdezz rá a lényegre. Ha rosszul válaszol, segíts rávezetni. Max 2-3 mondatban válaszolj. Magyarul beszélj.`;

    let conversation = [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBase64
            }
          },
          { text: userQuestion || 'Kezdd el a kikérdezést a jegyzet alapján. Tegyél fel egy kérdést.' }
        ]
      }
    ];

    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach(msg => {
        conversation.push({
          role: msg.role,
          parts: [{ text: msg.text }]
        });
      });
    }

    const result = await model.generateContent({ contents: conversation });
    const aiResponse = result.response.text();

    return new Response(JSON.stringify({ reply: aiResponse }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
