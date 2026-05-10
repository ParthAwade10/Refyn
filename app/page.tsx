'use client';

import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Mode = 'general' | 'coding';
type Status = 'idle' | 'engineering' | 'responding' | 'done' | 'error';

const ACCENT = {
  general: {
    badge: 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50',
    button: 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500',
    tabActive: 'bg-gray-700 text-indigo-300 shadow-sm',
    stepIcon: 'bg-indigo-950/60 text-indigo-400',
    stepBorder: 'border-indigo-900/40',
    dot: 'bg-indigo-400',
    link: 'text-indigo-400',
    copyBtn: 'hover:text-indigo-400',
    ring: 'focus:ring-indigo-500 focus:border-indigo-700',
  },
  coding: {
    badge: 'bg-violet-950/60 text-violet-300 border border-violet-800/50',
    button: 'bg-violet-600 hover:bg-violet-500 focus:ring-violet-500',
    tabActive: 'bg-gray-700 text-violet-300 shadow-sm',
    stepIcon: 'bg-violet-950/60 text-violet-400',
    stepBorder: 'border-violet-900/40',
    dot: 'bg-violet-400',
    link: 'text-violet-400',
    copyBtn: 'hover:text-violet-400',
    ring: 'focus:ring-violet-500 focus:border-violet-700',
  },
};

function CopyButton({ text, accent }: { text: string; accent: typeof ACCENT['general'] }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 text-xs text-gray-500 ${accent.copyBtn} transition-colors`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function LoadingDots({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse`}
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('general');
  const [query, setQuery] = useState('');
  const [engineeredPrompt, setEngineeredPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const a = ACCENT[mode];

  const streamText = useCallback(
    async (url: string, body: object, setter: (v: string) => void): Promise<boolean> => {
      abortRef.current = new AbortController();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setter('');

      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setter(accumulated);
      }
      return true;
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!query.trim() || status === 'engineering' || status === 'responding') return;

    setError(null);
    setEngineeredPrompt('');
    setResponse('');

    try {
      setStatus('engineering');
      let finalPrompt = '';
      await streamText('/api/engineer', { query, mode }, (v) => {
        setEngineeredPrompt(v);
        finalPrompt = v;
      });

      setStatus('responding');
      await streamText('/api/respond', { prompt: finalPrompt, mode }, setResponse);

      setStatus('done');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }, [query, mode, status, streamText]);

  const handleReset = () => {
    abortRef.current?.abort();
    setQuery('');
    setEngineeredPrompt('');
    setResponse('');
    setStatus('idle');
    setError(null);
  };

  const isActive = status === 'engineering' || status === 'responding';
  const showResults = engineeredPrompt || response || isActive;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700/60 bg-gray-900/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-100 tracking-tight">Refyn</span>
          </div>
          <span className="text-xs text-gray-600">Powered by Claude Opus</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-100 tracking-tight">
            Better prompts. Better answers.
          </h1>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Tell us what you want to know — Refyn engineers a precision prompt, then gets you the answer.
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-1 flex gap-1 w-fit">
            {(['general', 'coding'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  if (status === 'idle' || status === 'done' || status === 'error') {
                    setMode(m);
                    handleReset();
                  }
                }}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  mode === m
                    ? `${ACCENT[m].tabActive} font-semibold`
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {m === 'general' ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    General
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    Coding
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mode description */}
        <div className="text-center animate-fadeIn" key={mode}>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${a.badge}`}>
            {mode === 'general'
              ? 'Optimized for everyday questions, research, and analysis'
              : 'Optimized for code generation, debugging, and technical questions'}
          </span>
        </div>

        {/* Input Card */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
              Your Query
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              placeholder={
                mode === 'general'
                  ? 'Ask anything — explain quantum entanglement, summarize this article, write a cover letter...'
                  : 'Describe what you want to build — fix this bug, write a React hook, explain this algorithm...'
              }
              rows={4}
              disabled={isActive}
              className="w-full resize-none text-gray-100 placeholder-gray-600 bg-transparent text-sm leading-relaxed outline-none focus:ring-0 border-0 p-0 disabled:opacity-50"
            />
          </div>
          <div className="px-5 pb-5 flex items-center justify-between border-t border-gray-700/60 pt-4">
            <span className="text-xs text-gray-500">
              {query.length > 0 ? `${query.length} chars · ` : ''}{isActive ? '' : '⌘↵ to submit'}
            </span>
            <div className="flex items-center gap-2">
              {(showResults || query) && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-200 transition-colors"
                >
                  Reset
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || isActive}
                className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-30 disabled:cursor-not-allowed ${a.button}`}
              >
                {isActive ? (
                  <span className="flex items-center gap-2">
                    <LoadingDots color={a.dot} />
                    {status === 'engineering' ? 'Engineering...' : 'Responding...'}
                  </span>
                ) : (
                  'Refyn →'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="animate-fadeIn bg-red-950/50 border border-red-900/50 rounded-xl px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Step 1: Engineered Prompt */}
        {(engineeredPrompt || status === 'engineering') && (
          <div className={`animate-fadeIn bg-gray-800 rounded-2xl border ${a.stepBorder} overflow-hidden`}>
            <div className={`flex items-center justify-between px-5 py-3.5 border-b ${a.stepBorder}`}>
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${a.stepIcon}`}>
                  1
                </span>
                <span className="text-sm font-semibold text-gray-300">Engineered Prompt</span>
                {status === 'engineering' && <LoadingDots color={a.dot} />}
              </div>
              {engineeredPrompt && (
                <CopyButton text={engineeredPrompt} accent={a} />
              )}
            </div>
            <div className="px-5 py-4">
              {engineeredPrompt ? (
                <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap font-mono">
                  {engineeredPrompt}
                </p>
              ) : (
                <div className="space-y-2">
                  {[80, 60, 70, 45].map((w, i) => (
                    <div key={i} className="h-3 bg-gray-700 rounded animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Claude's Response */}
        {(response || status === 'responding') && (
          <div className="animate-fadeIn bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${a.stepIcon}`}>
                  2
                </span>
                <span className="text-sm font-semibold text-gray-300">Claude&apos;s Response</span>
                {status === 'responding' && <LoadingDots color={a.dot} />}
              </div>
              {response && (
                <CopyButton text={response} accent={a} />
              )}
            </div>
            <div className="px-5 py-4">
              {response ? (
                <div className="prose prose-sm prose-invert max-w-none text-gray-300 prose-headings:text-gray-100 prose-headings:font-semibold prose-strong:text-gray-200 prose-code:text-sm prose-pre:p-0 prose-pre:bg-transparent prose-a:text-indigo-400">
                  <ReactMarkdown
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match;
                        if (isInline) {
                          return (
                            <code
                              className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded text-xs font-mono border border-gray-600"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }
                        return (
                          <div className="rounded-xl overflow-hidden my-4 text-xs border border-gray-700">
                            <SyntaxHighlighter
                              style={oneDark}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{
                                margin: 0,
                                borderRadius: '0.75rem',
                                fontSize: '0.75rem',
                                lineHeight: '1.6',
                                background: '#1a1f2e',
                              }}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          </div>
                        );
                      },
                    }}
                  >
                    {response}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="space-y-2">
                  {[90, 75, 85, 60, 70].map((w, i) => (
                    <div key={i} className="h-3 bg-gray-700 rounded animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Done state */}
        {status === 'done' && (
          <div className="animate-fadeIn text-center py-4">
            <p className="text-xs text-gray-500">
              Want to try another query?{' '}
              <button onClick={handleReset} className={`${a.link} font-medium hover:underline`}>
                Start over
              </button>
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700/60 mt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <span className="text-xs text-gray-500">Refyn — Prompt Engineering, Perfected</span>
          <span className="text-xs text-gray-500">claude-opus-4-7</span>
        </div>
      </footer>
    </div>
  );
}
