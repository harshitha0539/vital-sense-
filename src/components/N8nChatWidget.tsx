import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  X,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { HealthReportAnalysis } from '../types';

export const N8N_CHAT_WEBHOOK_URL =
  'https://harshitha39.app.n8n.cloud/webhook/90bab5af-e28b-4460-b3b3-40029d90c209/chat';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

interface N8nChatWidgetProps {
  reportData: HealthReportAnalysis;
}

export function N8nChatWidget({ reportData }: N8nChatWidgetProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [mode, setMode] = useState<'native' | 'hosted'>('native');
  const [sessionId, setSessionId] = useState<string>(() => `vs-${Date.now().toString(36)}`);
  const [input, setInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [includeReportContext, setIncludeReportContext] = useState<boolean>(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: `Hello ${reportData.patientName}! I am your Vitalsense n8n Clinical Assistant. Ask me about your lab biomarkers (${reportData.summaryHeadline}), Chrono-Nutrition meals, medication spacing rules, or specialist hospital fees.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && mode === 'native') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, mode]);

  const extractBotReply = (payload: any): string => {
    if (!payload) return 'Received empty response from n8n workflow.';
    if (typeof payload === 'string') return payload;
    if (Array.isArray(payload)) {
      const first = payload[0];
      if (!first) return 'Received empty array from n8n workflow.';
      return (
        first.output ||
        first.text ||
        first.response ||
        first.message ||
        JSON.stringify(first)
      );
    }
    return (
      payload.output ||
      payload.text ||
      payload.response ||
      payload.message ||
      payload.data ||
      JSON.stringify(payload)
    );
  };

  const sendMessage = async (rawQuestion: string) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    const biomarkerSummary = reportData.biomarkers
      .map((b) => `${b.name}: ${b.value} ${b.unit} (${b.status})`)
      .join(', ');

    const enrichedChatInput = includeReportContext
      ? `[Patient Context: ${reportData.patientName} | Report: ${reportData.reportTitle} | Biomarkers: ${biomarkerSummary}]\n\nUser Question: ${trimmed}`
      : trimmed;

    try {
      let data: any = null;

      // First try server proxy (/api/n8n-chat) to avoid browser CORS blocks
      const proxyRes = await fetch('/api/n8n-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendMessage',
          sessionId,
          chatInput: enrichedChatInput,
          metadata: {
            patientName: reportData.patientName,
            reportTitle: reportData.reportTitle,
            recommendedSpecialist: reportData.recommendedSpecialistCategory,
          },
        }),
      });

      if (proxyRes.ok) {
        data = await proxyRes.json();
      } else {
        // Fallback to direct client call to n8n webhook
        const directRes = await fetch(N8N_CHAT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sendMessage',
            sessionId,
            chatInput: enrichedChatInput,
          }),
        });
        const text = await directRes.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { output: text };
        }
      }

      const replyText = extractBotReply(data);

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: 'Could not reach the n8n chat webhook. Make sure your n8n workflow is toggled to "Active" in n8n Cloud, or switch to the "Hosted n8n View" tab above.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleResetSession = () => {
    const nextSession = `vs-${Date.now().toString(36)}`;
    setSessionId(nextSession);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'bot',
        text: `Started a fresh clinical chat session. How can I help you with your ${reportData.reportTitle}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const quickPrompts = [
    'Explain my out-of-range biomarkers and root cause',
    'What should I eat today to lower my HbA1c & LDL?',
    'Can I take Iron and Thyroid medicine together?',
    'Which specialist doctor has the most reasonable fee?',
  ];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div
          className={`mb-3 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
            isExpanded
              ? 'w-[92vw] sm:w-[600px] h-[80vh]'
              : 'w-[92vw] sm:w-[410px] h-[560px]'
          }`}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold tracking-tight truncate">
                  Vitalsense Clinical AI Assistant
                </div>
                <div className="text-[11px] text-teal-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span className="truncate">Connected to n8n Cloud Workflow</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setMode(mode === 'native' ? 'hosted' : 'native')}
                className="px-2 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors cursor-pointer"
                title="Switch between integrated chat and n8n hosted embed"
              >
                {mode === 'native' ? 'Hosted View' : 'Native Chat'}
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title={isExpanded ? 'Compact size' : 'Expand chat'}
              >
                {isExpanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Subheader Context Bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-600 shrink-0">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeReportContext}
                onChange={(e) => setIncludeReportContext(e.target.checked)}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>Auto-attach current lab report biomarkers</span>
            </label>
            <a
              href={N8N_CHAT_WEBHOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 hover:text-teal-900 font-medium inline-flex items-center gap-1 shrink-0"
            >
              <span>n8n Endpoint</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {mode === 'hosted' ? (
            /* Direct Hosted n8n Chat Trigger iframe */
            <div className="flex-1 bg-slate-50 relative">
              <iframe
                src={N8N_CHAT_WEBHOOK_URL}
                title="n8n Hosted Clinical Chatbot"
                className="w-full h-full border-0"
                allow="microphone; clipboard-write"
              />
            </div>
          ) : (
            /* Native Integrated Clinical Chat UI */
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#F8FAFC]">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                        msg.sender === 'user'
                          ? 'bg-teal-700 text-white rounded-br-xs'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs shadow-2xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1 font-mono tabular-nums">
                      {msg.sender === 'user' ? 'You' : 'n8n Clinical Agent'} · {msg.timestamp}
                    </span>
                  </div>
                ))}

                {isSending && (
                  <div className="flex items-start">
                    <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-500 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping" />
                      <span>n8n Clinical Agent is analyzing your biomarkers...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Biomarker Prompts */}
              <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto shrink-0">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    disabled={isSending}
                    onClick={() => sendMessage(qp)}
                    className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your lab report, diet, medicines, or doctors..."
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-700"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isSending}
                  className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 rounded-full bg-teal-700 hover:bg-teal-800 text-white shadow-lg flex items-center gap-2.5 text-xs font-semibold transition-all cursor-pointer"
      >
        {isOpen ? (
          <>
            <X className="w-4 h-4" />
            <span>Close Clinical AI Chat</span>
          </>
        ) : (
          <>
            <MessageSquare className="w-4 h-4" />
            <span>Ask Vitalsense AI (n8n)</span>
          </>
        )}
      </button>
    </div>
  );
}
