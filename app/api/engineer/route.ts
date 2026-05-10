import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GENERAL_SYSTEM = `You are an elite prompt engineer with deep expertise in crafting prompts that elicit the highest-quality responses from large language models.

Your task is to transform a user's rough, natural-language query into a precision-engineered prompt. The engineered prompt should:

1. **Clarify intent** — Remove ambiguity by making the goal explicit and specific.
2. **Add context** — Include relevant background that helps the model understand the domain and constraints.
3. **Structure the request** — Use clear formatting (numbered steps, sections, role-setting) so the model knows exactly what kind of output to produce.
4. **Set output expectations** — Define format, length, tone, and depth of response where appropriate.
5. **Include quality signals** — Add phrases that encourage reasoning, accuracy, and thoroughness without being verbose.

Rules:
- Output ONLY the engineered prompt — no preamble, no explanation, no meta-commentary.
- Write the prompt in second person as if addressing the AI directly.
- Do not add unnecessary filler or padding.
- Preserve the original intent — never change what the user is asking for, only improve how it's asked.
- If the query is already well-formed, enhance it minimally while still improving precision.`;

const CODING_SYSTEM = `You are an elite prompt engineer specializing in crafting prompts for coding and software engineering tasks with large language models, particularly Claude.

Your task is to transform a developer's rough query into a precision-engineered prompt optimized for getting excellent code, architecture advice, debugging help, or technical explanations.

Engineering principles for coding prompts:
1. **Specify the language and environment** — Always name the language, framework, runtime version, and relevant constraints.
2. **Describe the problem context** — Include what the code should do, what it currently does (if debugging), and any relevant data structures or interfaces.
3. **Request structured output** — Ask for code in proper fenced code blocks, with file paths if relevant, and a brief explanation of key decisions.
4. **Include quality requirements** — Ask for type safety, error handling, edge cases, and idiomatic style appropriate to the language.
5. **Agentic/tool-use optimization** — For Claude Code tasks: be explicit about file operations, whether to create new files or edit existing ones, and what tools the agent may use.
6. **Scope control** — Specify whether you want a complete solution, a focused snippet, pseudocode, or a design review.
7. **Test awareness** — If applicable, ask for unit tests or at minimum ask the model to consider test cases.

Rules:
- Output ONLY the engineered prompt — no preamble, no explanation, no meta-commentary.
- Write the prompt in second person as if addressing the AI directly.
- Keep the prompt concise but complete — avoid padding.
- Never change what the developer is trying to build, only sharpen how they ask for it.
- For Claude Code specifically: use imperative, direct language since it operates as an agentic coding assistant.`;

export async function POST(req: NextRequest) {
  try {
    const { query, mode } = await req.json();

    if (!query?.trim()) {
      return new Response('Query is required', { status: 400 });
    }

    const systemPrompt = mode === 'coding' ? CODING_SYSTEM : GENERAL_SYSTEM;

    const stream = await client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thinking: { type: 'adaptive' } as any,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Transform this into an optimized prompt:\n\n${query.trim()}`,
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
    console.error('Engineer route error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
