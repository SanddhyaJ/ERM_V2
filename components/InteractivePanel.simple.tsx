'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Bot, User } from 'lucide-react';
import { InteractiveMode, FlaggedContent, FlaggingAnalysis } from '@/app/types';
import ApiKeyInput from './ApiKeyInput';

interface InteractivePanelProps {
  mode: InteractiveMode;
  onBack: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  flags?: FlaggedContent[];
  flaggingAnalysis?: FlaggingAnalysis;
  severityBreakdown?: Record<string, string>;
}

export default function InteractivePanel({ mode, onBack }: InteractivePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Function to scroll to the bottom of the messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Automatically scroll to the bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sample function to add messages for testing
  const handleAddMessage = (type: 'user' | 'ai') => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      type: type,
      content: type === 'user' ? 'This is a sample user message' : 'This is a sample AI response',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newMessage]);
  };

  return (
    <div className="h-screen bg-gray-50 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Interactive Panel</h1>
        <Button onClick={onBack} variant="outline" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
      
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>
            Interactive chat with {mode.subMode === 'default-chat' ? 'default AI model' : 'custom workflow'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Fixed height chat container with scroll */}
          <div className="h-[400px] overflow-y-auto p-4 border-y">
            {messages.map(message => (
              <div 
                key={message.id} 
                className={`mb-4 flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`p-3 rounded-lg max-w-[70%] ${
                    message.type === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="flex items-center mb-1">
                    {message.type === 'user' ? <User size={14} /> : <Bot size={14} />}
                    <span className="text-xs ml-2">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Message input area */}
          <div className="p-4 flex space-x-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 border rounded-md px-3 py-2"
              placeholder="Type your message..."
            />
            <Button onClick={() => handleAddMessage('user')}>
              <Send size={16} />
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Test buttons - remove in production */}
      <div className="mt-4 flex justify-center space-x-2">
        <Button variant="outline" onClick={() => handleAddMessage('user')}>
          Add User Message
        </Button>
        <Button variant="outline" onClick={() => handleAddMessage('ai')}>
          Add AI Message
        </Button>
      </div>
    </div>
  );
}
