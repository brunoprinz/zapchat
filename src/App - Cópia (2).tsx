/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, User, Users, LogOut, Check, CheckCheck, Paperclip, X, FileText, Mic, Square, Trash2, Palette, MoreVertical, Edit2, Image as ImageIcon, Link as LinkIcon, Smile, Search } from 'lucide-react';
import { format } from 'date-fns';
import EmojiPicker from 'emoji-picker-react';

interface MessageFile {
  name: string;
  type: string;
  data: string;
  size: number;
}

interface Message {
  id: string;
  type: 'system' | 'user';
  action?: 'join' | 'leave';
  userId?: string;
  username?: string;
  avatar?: string;
  text: string;
  file?: MessageFile;
  timestamp: number;
  isNewLocal?: boolean;
  isEdited?: boolean;
  readBy?: string[];
}

interface OnlineUser {
  id: string;
  username: string;
  avatar?: string;
  lastSeen: number;
}

let audioCtx: AudioContext | null = null;

const initAudio = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};


// Adicione esta função dentro do seu componente App



const clearChat = () => {
  const password = window.prompt("Digite a senha de admin:");
  if (password) {
    // É essencial enviar o objeto { password } para o servidor validar
    socketRef.current?.emit("clear_all_messages", { password });
  }
};


const themes = {
  emerald: {
    bg: 'bg-emerald-600',
    hover: 'hover:bg-emerald-700',
    text: 'text-emerald-600',
    textHover: 'hover:text-emerald-600',
    lightBg: 'bg-emerald-100',
    ring: 'focus:ring-emerald-500',
    border: 'focus:border-emerald-500',
    dot: 'bg-emerald-500',
  },
  blue: {
    bg: 'bg-blue-600',
    hover: 'hover:bg-blue-700',
    text: 'text-blue-600',
    textHover: 'hover:text-blue-600',
    lightBg: 'bg-blue-100',
    ring: 'focus:ring-blue-500',
    border: 'focus:border-blue-500',
    dot: 'bg-blue-500',
  },
  purple: {
    bg: 'bg-purple-600',
    hover: 'hover:bg-purple-700',
    text: 'text-purple-600',
    textHover: 'hover:text-purple-600',
    lightBg: 'bg-purple-100',
    ring: 'focus:ring-purple-500',
    border: 'focus:border-purple-500',
    dot: 'bg-purple-500',
  },
  rose: {
    bg: 'bg-rose-600',
    hover: 'hover:bg-rose-700',
    text: 'text-rose-600',
    textHover: 'hover:text-rose-600',
    lightBg: 'bg-rose-100',
    ring: 'focus:ring-rose-500',
    border: 'focus:border-rose-500',
    dot: 'bg-rose-500',
  },
  amber: {
    bg: 'bg-amber-600',
    hover: 'hover:bg-amber-700',
    text: 'text-amber-600',
    textHover: 'hover:text-amber-600',
    lightBg: 'bg-amber-100',
    ring: 'focus:ring-amber-500',
    border: 'focus:border-amber-500',
    dot: 'bg-amber-500',
  }
};

const AVATARS = ['👤', '👩', '👨', '🤖', '👻', '👽', '👾', '🐱', '🐶', '🦊', '🐼', '🦄'];

const playSound = (type: 'join' | 'message') => {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'join') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'message') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

const MessageBubble = ({ msg, isMe, theme, onDelete, onEdit }: { msg: Message; isMe: boolean; theme: keyof typeof themes; onDelete?: (id: string) => void; onEdit?: (id: string, newText: string) => void; key?: string }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text || '');
  const menuRef = useRef<HTMLDivElement>(null);

  const isRead = msg.readBy && msg.readBy.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveEdit = () => {
    if (editText.trim() !== msg.text && onEdit) {
      onEdit(msg.id, editText.trim());
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col items-start w-full mb-2">
        <div className="flex items-start gap-3 max-w-[95%] md:max-w-[85%] w-full">
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm bg-white border border-slate-200 mt-1">
            {msg.avatar || '👤'}
          </div>
          <div className="flex flex-col items-start w-full">
            <div className="flex items-baseline gap-2 mb-1 px-1">
              <span className={`text-sm font-bold ${isMe ? themes[theme].text : 'text-slate-800'}`}>
                {msg.username}
              </span>
              <span className="text-xs text-slate-500">
                {format(msg.timestamp, 'HH:mm')}
              </span>
            </div>
            <div className="rounded-2xl px-4 py-3 shadow-sm bg-white border border-slate-200 w-full">
              <textarea 
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full text-sm resize-none outline-none bg-transparent"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => { setIsEditing(false); setEditText(msg.text || ''); }} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
                <button onClick={handleSaveEdit} className={`text-xs px-3 py-1 rounded-full text-black ${themes[theme].bg}`}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start w-full mb-2">
      <div className="flex items-start gap-3 max-w-[95%] md:max-w-[85%] w-full group">
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm bg-white border border-slate-200 mt-1">
          {msg.avatar || '👤'}
        </div>
        <div className="flex flex-col items-start w-full">
          <div className="flex items-baseline gap-2 mb-1 px-1">
            <span className={`text-sm font-bold ${isMe ? themes[theme].text : 'text-slate-800'}`}>
              {msg.username}
            </span>
            <span className="text-xs text-slate-500">
              {format(msg.timestamp, 'HH:mm')}
            </span>
          </div>
          <div className="flex items-center gap-2 w-full">
            <div 
              className={`rounded-2xl px-4 py-2 shadow-sm relative ${
                isMe 
                  ? `${themes[theme].lightBg} text-slate-800 rounded-tl-none` 
                  : 'bg-white text-slate-800 rounded-tl-none'
              }`}
            >
              {msg.file && (
                <div className="mb-2">
                  {msg.file.type.startsWith('image/') ? (
                    <img src={msg.file.data} alt={msg.file.name} className="max-w-full rounded-lg max-h-64 object-contain" onLoad={() => {
                      const chatContainer = document.getElementById('chat-container');
                      if (chatContainer) {
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                      }
                    }} />
                  ) : (msg.file.type.startsWith('audio/') || msg.file.name.match(/\.(webm|mp3|wav|ogg|m4a|aac|mp4)$/i)) ? (
                    <div className="flex flex-col gap-1">
                      <audio controls src={msg.file.data} className="max-w-full w-64 h-10" />
                      <a href={msg.file.data} download={msg.file.name} className={`text-[10px] ${themes[theme].text} hover:underline self-end`}>
                        Baixar áudio
                      </a>
                    </div>
                  ) : (
                    <a href={msg.file.data} download={msg.file.name} className="flex items-center gap-2 bg-black/5 p-2 rounded-lg hover:bg-black/10 transition-colors">
                      <FileText className="h-5 w-5" />
                      <span className="text-xs truncate max-w-[150px]">{msg.file.name}</span>
                    </a>
                  )}
                </div>
              )}
              {msg.text && <div className="text-sm break-words whitespace-pre-wrap">{msg.text}</div>}
              <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 justify-end">
                {msg.isEdited && <span className="italic mr-1">(editado)</span>}
                {isMe && (
                  isRead ? (
                    <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                  ) : (
                    <Check className={`h-3 w-3 ${themes[theme].text}`} />
                  )
                )}
              </div>
            </div>
            
            {isMe && onDelete && onEdit && (
              <div className="relative opacity-0 group-hover:opacity-100 transition-opacity" ref={menuRef}>
                <button 
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  title="Opções da mensagem"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {showMenu && (
                  <div className="absolute left-0 top-8 bg-white shadow-lg rounded-lg border border-slate-100 py-1 z-10 min-w-[120px]">
                    <button 
                      onClick={() => { setIsEditing(true); setShowMenu(false); }} 
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Edit2 className="h-4 w-4" /> Editar
                    </button>
                    <button 
                      onClick={() => { onDelete(msg.id); setShowMenu(false); }} 
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" /> Apagar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [theme, setTheme] = useState<keyof typeof themes>('emerald');
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [showBgInput, setShowBgInput] = useState(false);
  const [bgUrlInput, setBgUrlInput] = useState('');
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('👤');
  const [isJoined, setIsJoined] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<number>(Date.now());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const readMessagesRef = useRef<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    // Only connect when user joins
    if (!isJoined || !username) return;

    // Use the current origin for the socket connection
    const newSocket = io(window.location.origin);
    
    newSocket.on('connect', () => {
      newSocket.emit('join', { username, avatar });
    });

    newSocket.on('history', (history: Message[]) => {
      setMessages(history);
      if (history.length > 0) {
        const lastUserMsg = [...history].reverse().find(m => m.type === 'user');
        if (lastUserMsg) {
          lastMessageTimeRef.current = lastUserMsg.timestamp;
        }
      }
      
      if (document.hasFocus()) {

        history.forEach(m => {

          if (m.type === 'user' && m.username !== username && !readMessagesRef.current.has(m.id)) {

            newSocket.emit('readMessage', m.id);

            readMessagesRef.current.add(m.id);

          }

        });

      }
    
}); // <--- O ERRO ESTAVA AQUI! Faltava esse }); para fechar o 'history'

// AGORA SIM, FORA DAS OUTRAS CAIXAS, VOCÊ COLOCA OS NOVOS:

      newSocket.on("messages_cleared", () => {

        setMessages([]);

      });


      newSocket.on("error_notification", (msg: string) => {

        alert(msg);

      });

    newSocket.on('message', (message: Message) => {
      const messageWithFlag = { ...message, isNewLocal: true };
      setMessages((prev) => [...prev, messageWithFlag]);
      
      const isMe = message.username === username;
      
      if (!isMe) {
        if (document.hasFocus()) {
          newSocket.emit('readMessage', message.id);
          readMessagesRef.current.add(message.id);
        }
        if (message.type === 'system' && message.action === 'join') {
          playSound('join');
        } else if (message.type === 'user') {
          const now = Date.now();
          const timeSinceLastMsg = now - lastMessageTimeRef.current;
          // 5 minutes = 300000 ms
          if (timeSinceLastMsg >= 300000) {
            playSound('message');
          }
        }
      }
      
      if (message.type === 'user') {
        lastMessageTimeRef.current = Date.now();
      }
    });

    newSocket.on('users', (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    newSocket.on('typing', (typingUsername: string) => {
      setTypingUsers((prev) => {
        if (!prev.includes(typingUsername)) {
          return [...prev, typingUsername];
        }
        return prev;
      });
    });

    newSocket.on('stopTyping', (typingUsername: string) => {
      setTypingUsers((prev) => prev.filter(u => u !== typingUsername));
    });

    newSocket.on('messageDeleted', (messageId: string) => {
      setMessages((prev) => prev.filter(m => m.id !== messageId));
    });

    newSocket.on('messageEdited', (data: { id: string, text: string }) => {
      setMessages((prev) => prev.map(m => m.id === data.id ? { ...m, text: data.text, isEdited: true } : m));
    });

    newSocket.on('messageRead', ({ messageId, userId }: { messageId: string, userId: string }) => {
      setMessages((prev) => prev.map(m => {
        if (m.id === messageId) {
          const readBy = m.readBy || [];
          if (!readBy.includes(userId)) {
            return { ...m, readBy: [...readBy, userId] };
          }
        }
        return m;
      }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isJoined, username]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useEffect(() => {
    // Scroll automatically when messages change
    scrollToBottom();
    
    // Also set a small timeout to handle rendering delays
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, typingUsers]);

  useEffect(() => {
    const handleFocus = () => {
      if (socket && isJoined) {
        messages.forEach(m => {
          if (m.type === 'user' && m.username !== username && !readMessagesRef.current.has(m.id)) {
            socket.emit('readMessage', m.id);
            readMessagesRef.current.add(m.id);
          }
        });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [socket, isJoined, messages, username]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeleteMessage = (messageId: string) => {
    if (socket) {
      socket.emit('deleteMessage', messageId);
    }
  };

  const handleEditMessage = (messageId: string, newText: string) => {
    if (socket) {
      socket.emit('editMessage', { id: messageId, text: newText });
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      initAudio();
      setIsJoined(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("O arquivo deve ter no máximo 5MB.");
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    if (socket) {
      if (e.target.value.trim() !== '') {
        socket.emit('typing');
        
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit('stopTyping');
        }, 2000);
      } else {
        socket.emit('stopTyping');
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !socket) return;

    const payload = {
      text: inputText.trim(),
      file: selectedFile && filePreview ? {
        name: selectedFile.name,
        type: selectedFile.type,
        data: filePreview,
        size: selectedFile.size
      } : undefined
    };

    socket.emit('message', payload);
    socket.emit('stopTyping');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setInputText('');
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          let ext = 'webm';
          if (mimeType.includes('mp4')) ext = 'mp4';
          else if (mimeType.includes('ogg')) ext = 'ogg';
          else if (mimeType.includes('wav')) ext = 'wav';
          else if (mimeType.includes('mpeg')) ext = 'mp3';
          
          const file = new File([audioBlob], `audio_${Date.now()}.${ext}`, { type: mimeType });
          if (file.size > 5 * 1024 * 1024) {
            alert("O áudio deve ter no máximo 5MB.");
            return;
          }
          setSelectedFile(file);
          setFilePreview(base64data);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleLogout = () => {
    if (socket) {
      socket.emit('stopTyping');
      socket.disconnect();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsJoined(false);
    setUsername('');
    setMessages([]);
    setOnlineUsers([]);
    setTypingUsers([]);
  };

  const handleBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("O arquivo é muito grande. O limite é 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomBg(event.target.result as string);
          setShowBgInput(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBgUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bgUrlInput.trim()) {
      setCustomBg(bgUrlInput.trim());
      setBgUrlInput('');
      setShowBgInput(false);
    }
  };

  const handleRemoveBg = () => {
    setCustomBg(null);
  };

  const displayedMessages = messages.filter(msg => {
    if (!searchQuery.trim()) return true;
    if (msg.type === 'system') return false;
    const query = searchQuery.toLowerCase();
    if (msg.text.toLowerCase().includes(query)) return true;
    if (msg.file && msg.file.name.toLowerCase().includes(query)) return true;
    return false;
  });

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className={`text-3xl font-bold ${themes[theme].text} mb-2`}>ZapChat</h1>
            <p className="text-slate-500">Comunicação simples e rápida</p>
          </div>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Escolha seu Avatar
              </label>
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvatar(a)}
                    className={`w-10 h-10 rounded-full text-xl flex items-center justify-center transition-all ${
                      avatar === a 
                        ? `bg-slate-100 ring-2 ring-offset-2 ${themes[theme].ring}` 
                        : 'hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">
                Seu Nome
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl ${themes[theme].ring} ${themes[theme].border} sm:text-sm`}
                  placeholder="Como quer ser chamado?"
                  required
                  maxLength={20}
                />
              </div>
            </div>
            <button
              type="submit"
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-black ${themes[theme].bg} ${themes[theme].hover} focus:outline-none focus:ring-2 focus:ring-offset-2 ${themes[theme].ring} transition-colors`}
            >
              Entrar no Chat
            </button>
          </form>

          <div className="flex gap-2 justify-center mt-8">
            {(Object.keys(themes) as Array<keyof typeof themes>).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`w-6 h-6 rounded-full ${themes[t].bg} ${theme === t ? 'ring-2 ring-offset-2 ring-slate-400' : ''} transition-all`}
                title={`Tema ${t}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row max-w-6xl mx-auto shadow-xl overflow-hidden">
      {/* Sidebar - Online Users (Hidden on very small screens, or shown as a top bar) */}
      <div className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col h-auto md:h-screen">
        <div className={`p-4 ${themes[theme].bg} text-black flex justify-between items-center`}>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" />
            ZapChat
          </h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleLogout}
              className={`p-2 ${themes[theme].hover} rounded-full transition-colors`}
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>

          </div>
        </div>


{/* Exemplo de onde colocar no App.tsx */}
<div className="flex items-center gap-2">
  <button
    onClick={clearChat}
    className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors"
    title="Limpar mensagens"
  >
    <Trash2 className="h-5 w-5" />
  </button>
  {/* ... botão de usuários que já existe ... */}
</div>
        
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xl shadow-sm">
            {avatar}
          </div>
          <div>
            <p className="text-xs text-slate-500">Logado como</p>
            <p className="text-sm font-bold text-slate-900">{username}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 hidden md:block">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Online ({onlineUsers.length})
          </h3>
          <ul className="space-y-3">
            {onlineUsers.map((user) => (
              <li key={user.id} className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm">
                    {user.avatar || '👤'}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${themes[theme].dot}`}></div>
                </div>
                <span className="text-sm text-slate-700 font-medium truncate">{user.username}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Mobile online users summary */}
        <div className="md:hidden p-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 text-center">
          {onlineUsers.length} usuário(s) online
        </div>

        {/* Theme Selector */}
        <div className="p-3 md:p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
          <div className="flex items-center justify-between md:flex-col md:items-start md:justify-start gap-2">
            <button 
              onClick={() => {
                const keys = Object.keys(themes) as Array<keyof typeof themes>;
                const next = keys[(keys.indexOf(theme) + 1) % keys.length];
                setTheme(next);
              }}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 uppercase tracking-wider md:mb-1 flex items-center gap-2 transition-colors cursor-pointer"
              title="Mudar tema"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden md:inline">Tema</span>
            </button>
            <div className="flex gap-2">
              {(Object.keys(themes) as Array<keyof typeof themes>).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`w-6 h-6 rounded-full ${themes[t].bg} ${theme === t ? 'ring-2 ring-offset-2 ring-slate-400' : ''} transition-all`}
                  title={`Tema ${t}`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                <span className="hidden md:inline">Fundo</span>
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setShowBgInput(!showBgInput)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  title="Adicionar fundo personalizado"
                >
                  <LinkIcon className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => bgFileInputRef.current?.click()}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  title="Fazer upload de imagem"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                {customBg && (
                  <button 
                    onClick={handleRemoveBg}
                    className="p-1 text-red-400 hover:text-red-600 rounded"
                    title="Remover fundo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            <input 
              type="file" 
              ref={bgFileInputRef} 
              onChange={handleBgFileChange} 
              className="hidden" 
              accept="image/*"
            />

            {showBgInput && (
              <form onSubmit={handleBgUrlSubmit} className="flex gap-1">
                <input
                  type="url"
                  value={bgUrlInput}
                  onChange={(e) => setBgUrlInput(e.target.value)}
                  placeholder="URL da imagem..."
                  className="flex-1 text-xs rounded border-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                <button type="submit" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded text-xs">
                  OK
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        className="flex-1 flex flex-col h-[calc(100vh-120px)] md:h-screen bg-[#efeae2] relative"
        style={customBg ? {
          backgroundImage: `url(${customBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        } : {}}
      >
        {customBg && <div className="absolute inset-0 bg-white/40 z-0 pointer-events-none"></div>}
        
        {/* Top Bar / Search */}
        <div className="z-20 bg-white/90 backdrop-blur-sm border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-sm">
          {showSearch ? (
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar mensagens..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-full text-sm transition-all outline-none"
                  autoFocus
                />
              </div>
              <button 
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="p-2 text-slate-500 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
                title="Fechar pesquisa"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex-1 flex justify-end">
              <button 
                onClick={() => setShowSearch(true)}
                className="p-2 text-slate-500 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors flex items-center gap-2"
                title="Pesquisar mensagens"
              >
                <Search className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">Pesquisar</span>
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 z-10" id="chat-container">
          {displayedMessages.length === 0 && searchQuery.trim() !== '' ? (
            <div className="flex justify-center items-center h-full">
              <div className="bg-white/80 backdrop-blur-sm px-6 py-4 rounded-xl shadow-sm text-center">
                <Search className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600 font-medium">Nenhuma mensagem encontrada</p>
                <p className="text-slate-400 text-sm mt-1">Tente pesquisar com outras palavras</p>
              </div>
            </div>
          ) : (
            displayedMessages.map((msg) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="bg-slate-200/80 text-slate-600 text-xs py-1 px-3 rounded-full shadow-sm">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = msg.username === username;

              return <MessageBubble key={msg.id} msg={msg} isMe={isMe} theme={theme} onDelete={handleDeleteMessage} onEdit={handleEditMessage} />;
            })
          )}
          
          {typingUsers.length > 0 && !searchQuery.trim() && (
            <div className="flex items-center gap-2 text-slate-500 text-xs italic px-4 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              {typingUsers.length === 1 
                ? `${typingUsers[0]} está digitando...` 
                : `${typingUsers.join(', ')} estão digitando...`}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-slate-100 border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            {selectedFile && (
              <div className="mb-2 flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200 w-fit">
                <div className={`flex items-center justify-center ${themes[theme].lightBg} ${themes[theme].text} p-2 rounded-md`}>
                  <Paperclip className="h-4 w-4" />
                </div>
                <div className="text-xs text-slate-600 truncate max-w-[150px] md:max-w-[300px]">
                  {selectedFile.name}
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`text-slate-500 ${themes[theme].textHover} transition-colors p-2 rounded-full hover:bg-slate-200 disabled:opacity-50`}
                title="Anexar arquivo (máx 5MB)"
                disabled={isRecording}
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
              />
              
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`text-slate-500 ${themes[theme].textHover} transition-colors p-2 rounded-full hover:bg-slate-200 disabled:opacity-50`}
                  title="Inserir emoji"
                  disabled={isRecording}
                >
                  <Smile className="h-5 w-5" />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-12 left-0 md:left-0 -left-10 z-50">
                    <EmojiPicker 
                      onEmojiClick={(emojiObject) => {
                        setInputText(prev => prev + emojiObject.emoji);
                      }}
                    />
                  </div>
                )}
              </div>

              {isRecording ? (
                <div className="flex-1 flex items-center justify-between bg-red-50 rounded-full px-4 py-3 border border-red-200">
                  <div className="flex items-center gap-2 text-red-500 animate-pulse">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium">Gravando áudio...</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={cancelRecording} className="text-slate-500 hover:text-red-600 transition-colors" title="Cancelar gravação">
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={stopRecording} className="text-red-500 hover:text-red-600 transition-colors" title="Parar e anexar">
                      <Square className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder="Digite uma mensagem..."
                  className={`flex-1 rounded-full border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 ${themes[theme].ring} shadow-sm text-sm`}
                  maxLength={500}
                />
              )}

              {(!inputText.trim() && !selectedFile && !isRecording) ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className={`${themes[theme].bg} text-black rounded-full p-3 ${themes[theme].hover} transition-colors shadow-sm flex items-center justify-center`}
                  title="Gravar áudio"
                >
                  <Mic className="h-5 w-5" />
                </button>
              ) : !isRecording && (
                <button
                  type="submit"
                  disabled={!inputText.trim() && !selectedFile}
                  className={`${themes[theme].bg} text-black rounded-full p-3 ${themes[theme].hover} disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center`}
                >
                  <Send className="h-5 w-5 ml-1" />
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}