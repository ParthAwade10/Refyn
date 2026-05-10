import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { prompt, mode } = await req.json();

    if (!prompt?.trim()) {
      return new Response('Prompt is required', { status: 400 });
    }

    const systemMessage =
      mode === 'coding'
        ? 'You are an expert software engineer and technical architect. Provide precise, idiomatic, production-quality code and technical explanations. Use fenced code blocks with language identifiers. Be thorough but concise.'
        : 'You are a knowledgeable, thoughtful assistant. Provide accurate, well-reasoned, and clearly structured responses. Be comprehensive yet concise.';

    const stream = await client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: 'adaptive' } as any,
      system: [
        {
          type: 'text',
          text: systemMessage,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: prompt.trim(),
        },
      ],
    });

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('Respond route error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
