/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  MoreVertical, 
  History, 
  FileText, 
  FileCode, 
  User, 
  Send, 
  Bird, 
  X,
  Mail,
  Cloud,
  Globe,
  Mic,
  MicOff,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { generatePDF, generateDocx } from './utils/fileGenerator';

// Types
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface HistoryItem {
  id: number;
  query: string;
  response: string;
  timestamp: string;
}

// Translations
const translations = {
  en: {
    accounts: "Accounts",
    language: "Language / Idioma",
    history: "Show History",
    createFile: "Create File",
    exportPdf: "Export as PDF",
    exportDocx: "Export as Docx",
    placeholder: "Message Athena...",
    welcomeTitle: "How can Athena assist you today?",
    welcomeSubtitle: "Ask me to research a topic, summarize data, or generate professional documents.",
    linkAccounts: "Link Accounts",
    googleAccount: "Google Account",
    microsoftAccount: "Microsoft Account",
    syncGmail: "Sync your Gmail and Drive",
    syncOutlook: "Sync Outlook and OneDrive",
    connect: "Connect",
    historyTitle: "Conversation History",
    noHistory: "No history found. Start a conversation!",
    query: "Query",
    response: "Response",
    noResearch: "No research content available. Please chat with Athena first!",
    reportTitle: "Research Report",
    reportFilename: "Research_Report",
    error: "I'm sorry, I encountered an error. Please check your API key or try again.",
    noResponse: "I'm sorry, I couldn't generate a response.",
    voiceMode: "Voice Mode",
    listening: "Listening...",
    passiveMode: "Waiting for 'Athena'...",
    stopVoice: "Stop Voice Mode",
    startVoice: "Start Voice Mode"
  },
  es: {
    accounts: "Cuentas",
    language: "Idioma / Language",
    history: "Ver Historial",
    createFile: "Crear Archivo",
    exportPdf: "Exportar como PDF",
    exportDocx: "Exportar como Docx",
    placeholder: "Enviar mensaje a Athena...",
    welcomeTitle: "¿Cómo puede Athena ayudarte hoy?",
    welcomeSubtitle: "Pídeme investigar un tema, resumir datos o generar documentos profesionales.",
    linkAccounts: "Vincular Cuentas",
    googleAccount: "Cuenta de Google",
    microsoftAccount: "Cuenta de Microsoft",
    syncGmail: "Sincroniza tu Gmail y Drive",
    syncOutlook: "Sincroniza Outlook y OneDrive",
    connect: "Conectar",
    historyTitle: "Historial de Conversaciones",
    noHistory: "No se encontró historial. ¡Comienza una conversación!",
    query: "Consulta",
    response: "Respuesta",
    noResearch: "No hay contenido de investigación disponible. ¡Por favor, chatea con Athena primero!",
    reportTitle: "Informe de Investigación",
    reportFilename: "Informe_de_Investigacion",
    error: "Lo siento, encontré un error. Por favor, verifica tu clave API o inténtalo de nuevo.",
    noResponse: "Lo siento, no pude generar una response.",
    voiceMode: "Modo de Voz",
    listening: "Escuchando...",
    passiveMode: "Esperando la palabra 'Athena'...",
    stopVoice: "Detener Modo de Voz",
    startVoice: "Iniciar Modo de Voz"
  }
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPassiveListening, setIsPassiveListening] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const kebabRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const currentTranscriptRef = useRef('');
  const isStartedRef = useRef(false);

  const t = translations[language];

  // Initialize Gemini
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'en' ? 'en-US' : 'es-ES';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Use a ref to track the state inside the callback to avoid stale closures
      const currentIsVoiceMode = (window as any)._athena_isVoiceMode;
      const currentIsPassive = (window as any)._athena_isPassive;

      const fullTranscript = (finalTranscript + interimTranscript).toLowerCase();

      if (!currentIsVoiceMode && currentIsPassive) {
        // Look for keyword variations
        if (fullTranscript.includes('athena') || fullTranscript.includes('atena') || fullTranscript.includes('atena ai')) {
          startActiveListening();
        }
      } else if (currentIsVoiceMode) {
        if (finalTranscript) {
          currentTranscriptRef.current += finalTranscript;
        }
        resetSilenceTimer();
      }
    };

    recognition.onstart = () => {
      isStartedRef.current = true;
    };

    recognition.onend = () => {
      isStartedRef.current = false;
      // Restart if we should still be listening
      if ((window as any)._athena_isPassive || (window as any)._athena_isVoiceMode) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech Recognition Error:', event.error);
      if (event.error === 'not-allowed') {
        setIsPassiveListening(false);
        setIsVoiceMode(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      isStartedRef.current = false;
    };
  }, [language]);

  // Sync state to window for access in recognition callbacks (avoiding stale closures)
  useEffect(() => {
    (window as any)._athena_isVoiceMode = isVoiceMode;
    (window as any)._athena_isPassive = isPassiveListening;
  }, [isVoiceMode, isPassiveListening]);

  // Handle starting/stopping recognition based on state
  useEffect(() => {
    if (!recognitionRef.current) return;

    const shouldBeRunning = isPassiveListening || isVoiceMode;
    
    if (shouldBeRunning && !isStartedRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    } else if (!shouldBeRunning && isStartedRef.current) {
      recognitionRef.current.stop();
    }
  }, [isPassiveListening, isVoiceMode]);

  const startPassiveListening = () => {
    setIsPassiveListening(true);
    currentTranscriptRef.current = '';
  };

  const stopPassiveListening = () => {
    setIsPassiveListening(false);
    if (!isVoiceMode) {
      setIsListening(false);
    }
  };

  const startActiveListening = () => {
    setIsVoiceMode(true);
    setIsListening(true);
    currentTranscriptRef.current = '';
    
    // Play a small sound or visual cue if needed
    const beep = new AudioContext();
    const osc = beep.createOscillator();
    const gain = beep.createGain();
    osc.connect(gain);
    gain.connect(beep.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(beep.currentTime + 0.1);
  };

  const stopVoiceMode = () => {
    setIsVoiceMode(false);
    setIsListening(false);
    currentTranscriptRef.current = '';
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      // Use the ref value which is updated in onresult
      const textToSend = currentTranscriptRef.current.trim();
      if (textToSend) {
        handleVoiceSend(textToSend);
        currentTranscriptRef.current = '';
      }
    }, 2000);
  };

  const handleVoiceSend = async (text: string) => {
    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are Athena, a professional AI assistant. Provide concise, accurate research and summaries. 
          STRICT RULE: You must detect the language of the user's input and respond EXCLUSIVELY in that same language. 
          If the user writes in Spanish, respond in Spanish. If the user writes in English, respond in English.`,
        },
        history: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
      });

      const result = await chat.sendMessage({ message: text });
      const responseText = result.text;
      
      const assistantMessage: Message = { role: 'assistant', content: responseText || t.noResponse };
      setMessages(prev => [...prev, assistantMessage]);
      saveToHistory(text, responseText || "");
      
      if (responseText) {
        speak(responseText);
      }
    } catch (error) {
      console.error('Gemini Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: t.error }]);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = (text: string) => {
    // Stop any current speaking
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'en' ? 'en-US' : 'es-ES';
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchHistory();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(event.target as Node)) {
        setShowKebab(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const saveToHistory = async (query: string, response: string) => {
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, response })
      });
      fetchHistory();
    } catch (err) {
      console.error('Failed to save history', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are Athena, a professional AI assistant. Provide concise, accurate research and summaries. 
          STRICT RULE: You must detect the language of the user's input and respond EXCLUSIVELY in that same language. 
          If the user writes in Spanish, respond in Spanish. If the user writes in English, respond in English.`,
        },
        history: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
      });

      const result = await chat.sendMessage({ message: input });
      const responseText = result.text;
      
      const assistantMessage: Message = { role: 'assistant', content: responseText || t.noResponse };
      setMessages(prev => [...prev, assistantMessage]);
      saveToHistory(input, responseText || "");
    } catch (error) {
      console.error('Gemini Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: t.error }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFile = (type: 'pdf' | 'docx') => {
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMessage) {
      alert(t.noResearch);
      return;
    }

    if (type === 'pdf') {
      generatePDF(lastAssistantMessage.content, `${t.reportFilename}.pdf`, t.reportTitle);
    } else {
      generateDocx(lastAssistantMessage.content, `${t.reportFilename}.docx`, t.reportTitle);
    }
    setShowKebab(false);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-navy-deep relative overflow-y-auto pt-[38px]">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-royal-soft/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Navigation */}
      <header className="h-16 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAccounts(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm font-medium"
          >
            <User size={16} />
            <span>{t.accounts}</span>
          </button>

          <button 
            onClick={() => setLanguage(prev => prev === 'en' ? 'es' : 'en')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm font-medium"
          >
            <Globe size={16} className="text-blue-400" />
            <span>{t.language}</span>
          </button>

          <button 
            onClick={() => isVoiceMode ? stopVoiceMode() : startActiveListening()}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
              isVoiceMode 
                ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
            title={isVoiceMode ? t.stopVoice : t.startVoice}
          >
            {isVoiceMode ? <MicOff size={16} /> : <Mic size={16} />}
            <span className="hidden md:inline">{isVoiceMode ? t.stopVoice : t.voiceMode}</span>
          </button>
          
          {!isVoiceMode && !isPassiveListening && (
            <button 
              onClick={startPassiveListening}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm font-medium"
            >
              <Volume2 size={16} className="text-purple-400" />
              <span className="hidden md:inline">Listen for "Athena"</span>
            </button>
          )}
          {isPassiveListening && !isVoiceMode && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/50 text-purple-400 text-sm font-medium animate-pulse">
              <Volume2 size={16} />
              <span className="hidden md:inline">{t.passiveMode}</span>
              <button onClick={stopPassiveListening} className="ml-1 hover:text-white"><X size={14} /></button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            ATHENA AI
          </h1>
        </div>

        <div className="relative" ref={kebabRef}>
          <button 
            onClick={() => setShowKebab(!showKebab)}
            className="p-2 rounded-lg hover:bg-white/10 transition-all"
          >
            <MoreVertical size={20} />
          </button>

          <AnimatePresence>
            {showKebab && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-56 rounded-xl glass-panel shadow-2xl z-50 overflow-hidden"
              >
                <button 
                  onClick={() => { setShowHistory(true); setShowKebab(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-all text-sm"
                >
                  <History size={16} className="text-blue-400" />
                  <span>{t.history}</span>
                </button>
                <div className="h-[1px] bg-white/10 mx-2" />
                <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500 font-bold">{t.createFile}</div>
                <button 
                  onClick={() => handleCreateFile('pdf')}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-all text-sm"
                >
                  <FileText size={16} className="text-red-400" />
                  <span>{t.exportPdf}</span>
                </button>
                <button 
                  onClick={() => handleCreateFile('docx')}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-all text-sm"
                >
                  <FileCode size={16} className="text-blue-500" />
                  <span>{t.exportDocx}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 z-10">
        <div className="w-full max-w-4xl h-full flex flex-col rounded-2xl border-2 border-transparent animate-glow bg-royal-soft/10 backdrop-blur-sm overflow-hidden shadow-2xl">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <div className="w-16 h-16 rounded-full bg-royal-soft/30 flex items-center justify-center">
                  <Bird className="text-blue-400" size={32} />
                </div>
                <p className="text-lg font-medium">{t.welcomeTitle}</p>
                <p className="text-sm max-w-xs">{t.welcomeSubtitle}</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'bg-royal-soft/40 border border-white/10 text-slate-100'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-royal-soft/40 border border-white/10 rounded-2xl px-4 py-3">
                  <Bird className="animate-bounce text-blue-400" size={18} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Bar or Voice Icon */}
          <div className="p-4 bg-black/20 border-t border-white/10">
            {isVoiceMode ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <motion.div 
                  animate={{ 
                    scale: isListening ? [1, 1.1, 1] : 1,
                    boxShadow: isListening 
                      ? ["0 0 0px rgba(168, 85, 247, 0)", "0 0 20px rgba(168, 85, 247, 0.6)", "0 0 0px rgba(168, 85, 247, 0)"] 
                      : "none"
                  }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={`w-24 h-24 rounded-full flex items-center justify-center border-4 transition-all ${
                    isListening ? 'border-purple-500 bg-purple-500/20' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <Bird size={48} className={isListening ? 'text-purple-400' : 'text-slate-500'} />
                </motion.div>
                <p className={`text-sm font-medium tracking-wide ${isListening ? 'text-purple-400 animate-pulse' : 'text-slate-500'}`}>
                  {isListening ? t.listening : t.voiceMode}
                </p>
                <button 
                  onClick={stopVoiceMode}
                  className="text-xs text-slate-500 hover:text-white underline transition-all"
                >
                  {t.stopVoice}
                </button>
              </div>
            ) : (
              <div className="relative flex items-center">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={t.placeholder}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-sm"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-3 p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                >
                  <Send size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAccounts && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAccounts(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md glass-panel rounded-2xl p-8 shadow-2xl"
            >
              <button 
                onClick={() => setShowAccounts(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-6">{t.linkAccounts}</h2>
              <div className="space-y-4">
                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Mail className="text-blue-400" size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{t.googleAccount}</p>
                      <p className="text-xs text-slate-400">{t.syncGmail}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-white/10 text-[10px] uppercase font-bold group-hover:bg-blue-600 transition-all">{t.connect}</div>
                </button>
                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
                      <Cloud className="text-blue-500" size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{t.microsoftAccount}</p>
                      <p className="text-xs text-slate-400">{t.syncOutlook}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-white/10 text-[10px] uppercase font-bold group-hover:bg-blue-600 transition-all">{t.connect}</div>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showHistory && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="relative w-full max-w-2xl h-[80vh] glass-panel rounded-2xl flex flex-col shadow-2xl"
            >
              <div className="p-6 border-bottom border-white/10 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <History className="text-blue-400" />
                  {t.historyTitle}
                </h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center opacity-50 italic">
                    {t.noHistory}
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">{t.query}</p>
                        <p className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
                      </div>
                      <p className="text-sm font-medium">{item.query}</p>
                      <div className="h-[1px] bg-white/5 my-2" />
                      <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">{t.response}</p>
                      <p className="text-xs text-slate-300 line-clamp-3">{item.response}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
