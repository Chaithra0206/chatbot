import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

export function MarkdownMessage({ content, isUser = false }: MarkdownMessageProps) {
  if (isUser) {
    return <div className="whitespace-pre-wrap break-words">{content}</div>;
  }

  return (
    <div className="text-slate-800 leading-relaxed break-words space-y-1.5">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul
              style={{ listStyleType: 'disc' }}
              className="list-disc list-outside pl-5 space-y-1.5 my-2 text-slate-800"
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              style={{ listStyleType: 'decimal' }}
              className="list-decimal list-outside pl-5 space-y-1.5 my-2 text-slate-800"
            >
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-slate-900 mt-3 mb-1.5">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-slate-900 mt-2.5 mb-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-slate-900 mt-2 mb-1">{children}</h3>
          ),
          code: ({ children, className }) => {
            const isCodeBlock = className?.includes('language-');
            if (isCodeBlock) {
              return (
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl overflow-x-auto my-2 text-xs font-mono">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="bg-blue-100/70 text-blue-900 px-1.5 py-0.5 rounded text-xs font-mono font-medium">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-3 border-blue-400 pl-3 italic text-slate-600 my-2">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline underline-offset-2 font-medium"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
