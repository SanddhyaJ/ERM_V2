'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Bot, User, Workflow, AlertTriangle, Flag, ChevronDown, ChevronUp, Shield, BarChart3, FileText, Sparkles, TrendingUp, Info, Download } from 'lucide-react';
import { InteractiveMode, FlaggedContent, FlaggingAnalysis, PrincipleScore, PrincipleScoring, PrincipleVisualizationData } from '@/app/types';
import ApiKeyInput from './ApiKeyInput';
import AdditionalContext from './AdditionalContext';

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
  principleScoring?: PrincipleScoring;
}

export default function InteractivePanel({ mode, onBack }: InteractivePanelProps) {
  // Principle descriptions for tooltips
  const PRINCIPLE_DESCRIPTIONS = {
    transparency: 'Evaluates how open, honest, and clear the communication is about intentions, limitations, and processes.',
    respect: 'Assesses the level of dignity, courtesy, and consideration shown towards all individuals and their perspectives.',
    accountability: 'Measures the degree to which responsibility is taken for actions, decisions, and their consequences.',
    fairness: 'Evaluates the impartiality, justice, and equitable treatment in responses and recommendations.'
  };

  // Basic state management
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [workflowFile, setWorkflowFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [flaggedMessages, setFlaggedMessages] = useState<FlaggedContent[]>([]);
  const [isFlaggingEnabled, setIsFlaggingEnabled] = useState(true);
  const [expandedAnalysis, setExpandedAnalysis] = useState<Set<string>>(new Set());
  
  // Flags log filter state
  const [flagsLogFilters, setFlagsLogFilters] = useState({
    messageType: 'all', // 'all', 'user', 'ai'
    flagCategory: 'all', // 'all', 'ethical-concern', 'misinformation', etc.
    severityLevel: 'all' // 'all', 'high', 'medium', 'low'
  });
  
  // Summarizing agent state
  const [summaryContext, setSummaryContext] = useState('');
  const [summaryOutput, setSummaryOutput] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  
  // Principle scoring state
  const [principleScores, setPrincipleScores] = useState<PrincipleScore[]>([]);
  const [isPrincipleScoring, setIsPrincipleScoring] = useState(false);
  const [isPrincipleScoringEnabled, setIsPrincipleScoringEnabled] = useState(true);
  const [principleVisualizationData, setPrincipleVisualizationData] = useState<PrincipleVisualizationData[]>([]);
  
  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    content: string;
    title: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    content: '',
    title: ''
  });
  
  // PDF export state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  // Message cutoff state for analysis
  const [messageCutoff, setMessageCutoff] = useState<number>(0); // 0 means no cutoff (use all messages)
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to get filtered messages based on cutoff
  const getFilteredMessages = (): Message[] => {
    if (messageCutoff === 0 || messageCutoff >= messages.length) {
      return messages;
    }
    return messages.slice(0, messageCutoff);
  };

  // Helper function to get hostname from URL
  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  // More intelligent scrollToBottom function that checks if user is near the bottom
  const scrollToBottomIfNearBottom = () => {
    const messagesContainer = document.querySelector('.messages-container');
    if (messagesContainer) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
      // If user is scrolled near the bottom (within 300px), auto-scroll
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;
      if (isNearBottom) {
        scrollToBottom();
      }
    } else {
      scrollToBottom();
    }
  };

  useEffect(() => {
    // Use the more intelligent scroll function instead
    scrollToBottomIfNearBottom();
  }, [messages, expandedAnalysis]);
  
  // Update principle visualization data when messages change
  useEffect(() => {
    const filteredMessages = getFilteredMessages();
    if (filteredMessages.length > 0) {
      updatePrincipleVisualizationData(filteredMessages);
    } else {
      // Initialize with empty visualization data when no messages
      const principles = [
        { id: 'transparency', name: 'Transparency' },
        { id: 'respect', name: 'Respect' },
        { id: 'accountability', name: 'Accountability' },
        { id: 'fairness', name: 'Fairness' }
      ];
      
      const emptyVizData = principles.map(principle => ({
        principleId: principle.id,
        principleName: principle.name,
        userScores: [],
        aiScores: []
      }));
      
      setPrincipleVisualizationData(emptyVizData);
    }
  }, [messages, messageCutoff]);
  
  // Update cutoff when messages change to default to all messages
  useEffect(() => {
    if (messages.length > 0) {
      setMessageCutoff(messages.length);
    } else {
      setMessageCutoff(0);
    }
  }, [messages.length]);
  
  // Enhanced scroll behavior - smooth scroll with slight delay for animations
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottomIfNearBottom();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const analyzeMessage = async (message: Message, allMessages: Message[]) => {
    if (!isFlaggingEnabled || !isConnected || mode.subMode !== 'default-chat') {
      console.log('Skipping analysis:', { 
        flaggingEnabled: isFlaggingEnabled, 
        connected: isConnected, 
        mode: mode.subMode,
        messageType: message.type,
        messageId: message.id
      });
      return;
    }

    console.log('Analyzing message:', { 
      type: message.type, 
      id: message.id, 
      content: message.content.substring(0, 50) + '...' 
    });

    try {
      // Include context around the message being analyzed
      const contextMessages = allMessages.slice(-5).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      const response = await fetch('/api/flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: contextMessages,
          apiKey: apiKey,
          baseUrl: baseUrl || undefined,
          model: selectedModel || 'gpt-3.5-turbo',
          additionalContext: summaryContext || undefined,
        }),
      });

      if (response.ok) {
        const flaggingResult = await response.json();
        
        console.log('Flagging result received:', {
          shouldFlag: flaggingResult.shouldFlag,
          hasFlags: flaggingResult.flags?.length > 0,
          reasoningLength: flaggingResult.reasoning?.length || 0,
          hasSeverityBreakdown: !!flaggingResult.severityBreakdown
        });
        
        const analysis: FlaggingAnalysis = {
          id: `analysis-${Date.now()}-${Math.random()}`,
          messageId: message.id,
          shouldFlag: flaggingResult.shouldFlag || false,
          flags: [],
          reasoning: flaggingResult.reasoning || 'Analysis completed successfully.',
          analysisTimestamp: new Date(),
        };

        let newFlags: FlaggedContent[] = [];
        
        // Check for explicit flags from the API response
        if (flaggingResult.shouldFlag && flaggingResult.flags && flaggingResult.flags.length > 0) {
          newFlags = flaggingResult.flags.map((flag: {
            type: string;
            severity: string;
            reason: string;
            flaggedText: string;
          }) => ({
            id: `flag-${Date.now()}-${Math.random()}`,
            messageId: message.id,
            type: flag.type as FlaggedContent['type'],
            severity: flag.severity as FlaggedContent['severity'],
            reason: flag.reason,
            flaggedText: flag.flaggedText,
            timestamp: new Date(),
            resolved: false,
          }));
        }

        // Also check severity breakdown for any categories above "none"
        if (flaggingResult.severityBreakdown) {
          const severityFlagsFromBreakdown = Object.entries(flaggingResult.severityBreakdown)
            .filter(([_, severity]) => severity !== 'none')
            .map(([type, severity]) => ({
              id: `flag-${Date.now()}-${Math.random()}-${type}`,
              messageId: message.id,
              type: type as FlaggedContent['type'],
              severity: severity as FlaggedContent['severity'],
              reason: `Content flagged for ${type.replace('-', ' ')} with ${severity} severity`,
              flaggedText: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
              timestamp: new Date(),
              resolved: false,
            }));

          // Merge with existing flags, avoiding duplicates
          const existingTypes = new Set(newFlags.map(flag => flag.type));
          const uniqueSeverityFlags = severityFlagsFromBreakdown.filter(flag => !existingTypes.has(flag.type));
          newFlags = [...newFlags, ...uniqueSeverityFlags];
        }

        if (newFlags.length > 0) {
          analysis.flags = newFlags;
          setFlaggedMessages(prev => [...prev, ...newFlags]);
        }
        
        // Auto-expand analysis if message has any flags
        if (newFlags.length > 0 && !expandedAnalysis.has(message.id)) {
          setExpandedAnalysis(prev => new Set([...prev, message.id]));
        }

        // Update the message with the analysis
        setMessages(prev => {
          return prev.map(msg => {
            if (msg.id === message.id) {
              return {
                ...msg,
                flags: newFlags.length > 0 ? newFlags : undefined,
                flaggingAnalysis: analysis,
                severityBreakdown: flaggingResult.severityBreakdown || {}
              };
            }
            return msg;
          });
        });
      } else {
        console.error('Flagging API request failed:', response.status, response.statusText);
        
        // Create a fallback analysis for failed requests
        const fallbackAnalysis: FlaggingAnalysis = {
          id: `analysis-${Date.now()}-${Math.random()}`,
          messageId: message.id,
          shouldFlag: false,
          flags: [],
          reasoning: 'Analysis failed - please check your API configuration',
          analysisTimestamp: new Date(),
        };

        // Update the message with the fallback analysis
        setMessages(prev => {
          return prev.map(msg => {
            if (msg.id === message.id) {
              return {
                ...msg,
                flaggingAnalysis: fallbackAnalysis,
                severityBreakdown: {
                  "ethical-concern": "none",
                  "harmful-content": "none",
                  "misinformation": "none",
                  "bias": "none",
                  "other": "none"
                }
              };
            }
            return msg;
          });
        });
      }
    } catch (error) {
      console.error('Error analyzing message:', error);
      
      // Create a fallback analysis for errors
      const errorAnalysis: FlaggingAnalysis = {
        id: `analysis-${Date.now()}-${Math.random()}`,
        messageId: message.id,
        shouldFlag: false,
        flags: [],
        reasoning: 'Analysis error - please check your connection and API key',
        analysisTimestamp: new Date(),
      };

      // Update the message with the error analysis
      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === message.id) {
            return {
              ...msg,
              flaggingAnalysis: errorAnalysis,
              severityBreakdown: {
                "ethical-concern": "none",
                "harmful-content": "none",
                "misinformation": "none",
                "bias": "none",
                "other": "none"
              }
            };
          }
          return msg;
        });
      });
    }
  };

  const scorePrinciples = async (message: Message, allMessages: Message[]) => {
    console.log('scorePrinciples called with:', {
      messageId: message.id,
      messageType: message.type,
      isPrincipleScoringEnabled,
      isConnected,
      subMode: mode.subMode,
      allMessagesCount: allMessages.length
    });
    
    if (!isPrincipleScoringEnabled || !isConnected || mode.subMode !== 'default-chat') {
      console.log('Skipping principle scoring:', { 
        principleScoringEnabled: isPrincipleScoringEnabled, 
        connected: isConnected, 
        mode: mode.subMode,
        messageType: message.type,
        messageId: message.id
      });
      return;
    }

    console.log('Scoring principles for message:', { 
      type: message.type, 
      id: message.id, 
      content: message.content.substring(0, 50) + '...' 
    });

    try {
      // Include context around the message being analyzed
      const contextMessages = allMessages.slice(-5).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      const response = await fetch('/api/principle_scoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: contextMessages,
          apiKey: apiKey,
          baseUrl: baseUrl || undefined,
          model: selectedModel || 'gpt-3.5-turbo',
          additionalContext: summaryContext || undefined,
        }),
      });

      console.log('Principle scoring API call made with:', {
        apiKey: apiKey,
        contextMessagesLength: contextMessages.length,
        messageId: message.id,
        messageType: message.type
      });

      if (response.ok) {
        const principleResult = await response.json();
        
        console.log('Principle scoring API response:', {
          success: principleResult.success,
          scores: principleResult.scores,
          messageId: message.id,
          messageType: message.type,
          actualScoreValues: principleResult.scores?.map((s: any) => s.score)
        });
        
        if (principleResult.success && principleResult.scores) {
          console.log('Principle scoring successful:', {
            messageId: message.id,
            messageType: message.type,
            scores: principleResult.scores.map((s: any) => ({ principle: s.principleName, score: s.score }))
          });
          
          const scoring: PrincipleScoring = {
            id: `scoring-${Date.now()}-${Math.random()}`,
            messageId: message.id,
            scores: principleResult.scores.map((score: any) => ({
              id: `score-${Date.now()}-${Math.random()}`,
              messageId: message.id,
              principleId: score.principleId,
              score: score.score,
              reasoning: score.reasoning,
              timestamp: new Date(),
            })),
            analysisTimestamp: new Date(),
          };

          // Add scores to the global scores array
          console.log('Adding principle scores to global array:', scoring.scores);
          setPrincipleScores(prev => {
            const newScores = [...prev, ...scoring.scores];
            console.log('Updated principle scores array:', newScores);
            return newScores;
          });

          // Update the message with the principle scoring
          setMessages(prev => {
            const updatedMessages = prev.map(msg => {
              if (msg.id === message.id) {
                return {
                  ...msg,
                  principleScoring: scoring
                };
              }
              return msg;
            });
            
            // Update visualization data with the updated messages
            setTimeout(() => {
              console.log('About to update viz data with messages:', updatedMessages.length);
              updatePrincipleVisualizationData(updatedMessages);
            }, 100);
            
            return updatedMessages;
          });
        }
      } else {
        console.error('Principle scoring API error:', response.status, response.statusText);
        const errorData = await response.json();
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('Error scoring principles:', error);
    }
  };

  const updatePrincipleVisualizationData = (allMessages: Message[]) => {
    const principles = [
      { id: 'transparency', name: 'Transparency' },
      { id: 'respect', name: 'Respect' },
      { id: 'accountability', name: 'Accountability' },
      { id: 'fairness', name: 'Fairness' }
    ];

    const vizData: PrincipleVisualizationData[] = principles.map(principle => {
      const userScores: { messageIndex: number; score: number; timestamp: Date; reasoning: string }[] = [];
      const aiScores: { messageIndex: number; score: number; timestamp: Date; reasoning: string }[] = [];

      allMessages.forEach((msg, index) => {
        if (msg.principleScoring?.scores) {
          const principleScore = msg.principleScoring.scores.find(s => s.principleId === principle.id);
          if (principleScore) {
            if (msg.type === 'user') {
              userScores.push({
                messageIndex: index,
                score: principleScore.score,
                timestamp: msg.timestamp,
                reasoning: principleScore.reasoning || 'No reasoning provided'
              });
            } else {
              aiScores.push({
                messageIndex: index,
                score: principleScore.score,
                timestamp: msg.timestamp,
                reasoning: principleScore.reasoning || 'No reasoning provided'
              });
            }
          }
        }
      });

      return {
        principleId: principle.id,
        principleName: principle.name,
        userScores,
        aiScores
      };
    });

    console.log('Updating principle visualization data:', {
      messagesWithScoring: allMessages.filter(m => m.principleScoring).length,
      totalMessages: allMessages.length,
      vizData: vizData.map(v => ({ 
        principle: v.principleName, 
        userScores: v.userScores.length, 
        aiScores: v.aiScores.length,
        userScoreValues: v.userScores.map(s => s.score),
        aiScoreValues: v.aiScores.map(s => s.score)
      }))
    });

    console.log('Setting principleVisualizationData to:', vizData);
    setPrincipleVisualizationData(vizData);
  };

  const toggleAnalysisExpansion = (messageId: string) => {
    setExpandedAnalysis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-orange-600 bg-orange-100';
      case 'none': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatContentType = (type: string) => {
    return type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Filter flagged messages based on current filters
  const getFilteredFlags = () => {
    const filteredMessages = getFilteredMessages();
    return flaggedMessages.filter(flag => {
      const flaggedMessage = filteredMessages.find(msg => msg.id === flag.messageId);
      
      // If message is not in the cutoff range, exclude it
      if (!flaggedMessage) return false;
      
      // Filter by message type
      if (flagsLogFilters.messageType !== 'all') {
        if (flaggedMessage.type !== flagsLogFilters.messageType) {
          return false;
        }
      }
      
      // Filter by flag category
      if (flagsLogFilters.flagCategory !== 'all') {
        if (flag.type !== flagsLogFilters.flagCategory) {
          return false;
        }
      }
      
      // Filter by severity level
      if (flagsLogFilters.severityLevel !== 'all') {
        if (flag.severity !== flagsLogFilters.severityLevel) {
          return false;
        }
      }
      
      return true;
    });
  };

  // Get unique flag categories for the filter dropdown
  const getUniqueCategories = () => {
    const categories = [...new Set(flaggedMessages.map(flag => flag.type))];
    return categories.sort();
  };

  // Get unique severity levels for the filter dropdown
  const getUniqueSeverities = () => {
    const severities = [...new Set(flaggedMessages.map(flag => flag.severity))];
    return severities.sort((a, b) => {
      const order = ['high', 'medium', 'low'];
      return order.indexOf(a) - order.indexOf(b);
    });
  };

  // Summarizing agent function
  const generateSummary = async () => {
    if (!isConnected || messages.length === 0) {
      console.log('Cannot generate summary - not connected or no messages');
      return;
    }

    console.log('Starting summary generation...');
    setIsSummarizing(true);
    setSummaryOutput('');

    try {
      // Use filtered messages based on cutoff
      const filteredMessages = getFilteredMessages();
      
      // Prepare conversation history
      const conversationHistory = filteredMessages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp.toISOString()
      }));

      // Prepare flagged content summary (only from filtered messages)
      const flaggedContent = flaggedMessages.filter(flag => 
        filteredMessages.some(msg => msg.id === flag.messageId)
      ).map(flag => ({
        type: flag.type,
        severity: flag.severity,
        reason: flag.reason,
        flaggedText: flag.flaggedText
      }));

      const requestBody = {
        conversationHistory,
        flaggedContent,
        context: summaryContext,
        format: 'bullets',
        apiKey,
        baseUrl: baseUrl || undefined,
        model: selectedModel || 'gpt-3.5-turbo',
      };

      console.log('Summary request:', {
        conversationLength: conversationHistory.length,
        flagsCount: flaggedContent.length,
        format: 'bullets',
        hasApiKey: !!apiKey,
        hasBaseUrl: !!baseUrl,
        model: selectedModel || 'gpt-3.5-turbo'
      });

      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Summary API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Summary data received:', Object.keys(data));
        setSummaryOutput(data.summary);
      } else {
        const error = await response.json();
        console.error('Summary API error:', error);
        throw new Error(error.error || `HTTP ${response.status}: Failed to generate summary`);
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummaryOutput(`Error generating summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Simple markdown renderer for summary output
  const renderMarkdown = (text: string) => {
    if (!text) return '';
    
    // Escape any existing HTML to prevent XSS
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    // Convert basic markdown to HTML (but NOT italic yet, as it interferes with bullet points)
    html = html
      // Bold text: **text** or __text__ (do bold first)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Headers: # ## ###
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-900">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2 text-gray-900">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2 text-gray-900">$1</h1>')
      // Double line breaks become paragraph breaks (before bullet point processing)
      .replace(/\n\n/g, '');

    // Process bullet points and numbered lists with proper grouping
    const lines = html.split('\n');
    const processedLines: string[] = [];
    let inList = false;
    let listType = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isBulletPoint = /^[\s]*[-*+]\s+(.*)$/.test(line);
      const isNumberedPoint = /^[\s]*\d+\.\s+(.*)$/.test(line);
      
      if (isBulletPoint || isNumberedPoint) {
        const content = line.replace(/^[\s]*[-*+\d.]\s+/, '');
        const currentListType = isBulletPoint ? 'ul' : 'ol';
        
        if (!inList) {
          // Start new list
          processedLines.push(`<${currentListType} class="list-disc list-inside mb-3 ml-4">`);
          inList = true;
          listType = currentListType;
        } else if (listType !== currentListType) {
          // Change list type, close previous and open new
          processedLines.push(`</${listType}>`);
          processedLines.push(`<${currentListType} class="list-disc list-inside mb-3 ml-4">`);
          listType = currentListType;
        }
        
        processedLines.push(`<li class="mb-1 text-gray-700">${content}</li>`);
      } else {
        if (inList) {
          // Close current list
          processedLines.push(`</${listType}>`);
          inList = false;
          listType = '';
        }
        processedLines.push(line);
      }
    }
    
    // Close any remaining list
    if (inList) {
      processedLines.push(`</${listType}>`);
    }
    
    html = processedLines.join('\n');
    
    // NOW process italic text (after bullet points are handled)
    html = html
      // Italic text: *text* or _text_ (but not at start of line, which are bullet points)
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/_([^_\n]+)_/g, '<em>$1</em>');
    
    // Process paragraph breaks and line breaks
    html = html
      .replace(/\n\n__PARAGRAPH_BREAK__\n\n/g, '</p><p class="mb-3 text-gray-700">')
      .replace(/\n/g, '');

    // Wrap content in paragraph tags if not already wrapped
    if (!html.includes('<p>') && !html.includes('<h1>') && !html.includes('<h2>') && 
        !html.includes('<h3>') && !html.includes('<ul>') && !html.includes('<ol>')) {
      html = '<p class="mb-3 text-gray-700">' + html + '</p>';
    }

    return html;
  };

  const handleApiKeySet = (key: string, url?: string, model?: string) => {
    setApiKey(key);
    setBaseUrl(url || '');
    setSelectedModel(model || 'gpt-3.5-turbo');
    setIsConnected(true);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isConnected) return;

    const userMessage = {
      id: `msg-${Date.now()}`,
      type: 'user' as const,
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);
    
    // Analyze user message immediately (before AI response)
    if (mode.subMode === 'default-chat') {
      setTimeout(() => {
        analyzeMessage(userMessage, [...messages, userMessage]);
        scorePrinciples(userMessage, [...messages, userMessage]);
      }, 100);
    }
    
    try {
      // Prepare conversation history for API
      const conversationHistory = [
        ...messages.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: inputMessage }
      ];

      // Add system message for custom workflow if applicable
      const systemMessage = mode.subMode === 'custom-workflow' && workflowFile
        ? { role: 'system', content: `You are operating with a custom workflow from file: ${workflowFile.name}. Respond according to the workflow specifications.` }
        : { role: 'system', content: 'You are a helpful AI assistant.' };

      const messages_for_api = [systemMessage, ...conversationHistory];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages_for_api,
          apiKey,
          baseUrl: baseUrl || undefined,
          model: selectedModel || 'gpt-3.5-turbo',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage = {
          id: `msg-${Date.now()}-ai`,
          type: 'ai' as const,
          content: data.message,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        // Analyze AI message separately
        if (mode.subMode === 'default-chat') {
          setTimeout(() => {
            analyzeMessage(aiMessage, [...messages, userMessage, aiMessage]);
            scorePrinciples(aiMessage, [...messages, userMessage, aiMessage]);
          }, 100);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get AI response');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage = {
        id: `msg-${Date.now()}-error`,
        type: 'ai' as const,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your API key and try again.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleWorkflowUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setWorkflowFile(e.target.files[0]);
    }
  };

  // PDF export function
  const exportAnalysisToPDF = async () => {
    if (!isConnected || messages.length === 0) {
      alert('Please connect to API and have at least one message to export analysis.');
      return;
    }

    setIsExportingPDF(true);
    
    try {
      // Use filtered messages based on cutoff
      const filteredMessages = getFilteredMessages();
      
      // Dynamic import to avoid SSR issues
      const jsPDF = (await import('jspdf')).default;
      
      // Create PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let currentY = 20;
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;

      // Helper function to add text with word wrapping
      const addTextWithWrapping = (text: string, fontSize: number, isBold: boolean = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        
        const lines = doc.splitTextToSize(text, maxWidth);
        
        // Check if we need a new page
        if (currentY + (lines.length * fontSize * 0.5) > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
        }
        
        doc.text(lines, margin, currentY);
        currentY += lines.length * fontSize * 0.5 + 5;
      };

      // Header
      addTextWithWrapping('Ethics Reasoning Module Interactive Mode Analysis', 18, true);
      
      // Subtitle with timestamp
      const timestamp = new Date().toLocaleString();
      addTextWithWrapping(`Generated on: ${timestamp}`, 12);
      
      // Add some space
      currentY += 10;
      
      // Generate summary if not already available
      let summaryText = summaryOutput;
      if (!summaryText) {

        // Generate summary using the existing function logic
        const conversationHistory = messages.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp.toISOString()
        }));

        const flaggedContent = flaggedMessages.map(flag => ({
          type: flag.type,
          severity: flag.severity,
          reason: flag.reason,
          flaggedText: flag.flaggedText
        }));

        const requestBody = {
          conversationHistory,
          flaggedContent,
          context: summaryContext,
          format: 'bullets',
          apiKey,
          baseUrl: baseUrl || undefined,
          model: selectedModel || 'gpt-3.5-turbo',
        };

        const response = await fetch('/api/summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();
          summaryText = data.summary;
        } else {
          summaryText = 'Failed to generate summary for PDF export.';
        }
      }
      
      // Add summary content
      addTextWithWrapping('Analysis Summary:', 14, true);
      
      // Convert markdown to plain text for PDF
      const plainTextSummary = summaryText
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
        .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
        .replace(/^#+\s+/gm, '') // Remove headers
        .replace(/^[-*+]\s+/gm, '• ') // Convert bullet points
        .replace(/^\d+\.\s+/gm, '• ') // Convert numbered lists
        .replace(/\n\n/g, '\n') // Reduce double line breaks
        .trim();
      
      addTextWithWrapping(plainTextSummary, 10);
      
      // Add conversation statistics
      currentY += 10;
      addTextWithWrapping('Conversation Statistics:', 14, true);
      addTextWithWrapping(`Total Messages: ${messages.length}`, 10);
      addTextWithWrapping(`User Messages: ${messages.filter(m => m.type === 'user').length}`, 10);
      addTextWithWrapping(`AI Messages: ${messages.filter(m => m.type === 'ai').length}`, 10);
      addTextWithWrapping(`Flagged Messages: ${flaggedMessages.length}`, 10);
      
      if (summaryContext) {
        currentY += 10;
        addTextWithWrapping('Context Information:', 14, true);
        addTextWithWrapping(summaryContext, 10);
      }
      
      // Add messages table
      currentY += 15;
      addTextWithWrapping('Conversation Messages:', 14, true);
      currentY += 10;
      
      // Create a simple table without autotable plugin
      const createSimpleTable = () => {
        const tableStartY = currentY;
        const colWidths = [25, 80, 25, 40]; // Column widths
        const rowHeight = 20;
        let currentRowY = tableStartY;
        
        // Draw table headers
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(66, 139, 202);
        doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
        
        doc.setTextColor(255, 255, 255);
        let currentX = margin + 2;
        const headers = ['Message ID', 'Message Content', 'Source', 'Timestamp'];
        headers.forEach((header, index) => {
          doc.text(header, currentX, currentRowY + 10);
          currentX += colWidths[index];
        });
        
        currentRowY += rowHeight;
        
        // Draw table data
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7);
        
        filteredMessages.forEach((message, index) => {
          // Check if we need a new page
          if (currentRowY + rowHeight > pageHeight - margin) {
            doc.addPage();
            currentRowY = margin;
          }
          
          // Draw row background (alternating colors)
          if (index % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
          }
          
          currentX = margin + 2;
          const rowData = [
            (index + 1).toString(),
            message.content.length > 40 ? message.content.substring(0, 40) + '...' : message.content,
            message.type === 'user' ? 'Human' : 'AI',
            message.timestamp.toLocaleTimeString()
          ];
          
          rowData.forEach((data, colIndex) => {
            // Wrap text if it's too long for the column
            const lines = doc.splitTextToSize(data, colWidths[colIndex] - 4);
            doc.text(lines[0], currentX, currentRowY + 10); // Only show first line to fit in row
            currentX += colWidths[colIndex];
          });
          
          // Draw row border
          doc.setDrawColor(200, 200, 200);
          doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'S');
          
          currentRowY += rowHeight;
        });
        
        return currentRowY;
      };
      
      currentY = createSimpleTable() + 10;
      
      // Add flags table if there are flagged messages
      if (flaggedMessages.length > 0) {
        currentY += 15;
        addTextWithWrapping('Flagged Content Analysis:', 14, true);
        currentY += 10;
        
        // Get all unique flagging categories from all messages
        const allCategories = new Set<string>();
        filteredMessages.forEach(msg => {
          if (msg.severityBreakdown) {
            Object.keys(msg.severityBreakdown).forEach(category => {
              allCategories.add(category);
            });
          }
        });
        
        const categoriesArray = Array.from(allCategories).sort();
        
        // Create flags table
        const createFlagsTable = () => {
          const tableStartY = currentY;
          const baseColWidths = [25, 60]; // Message ID, Analysis
          const categoryColWidth = categoriesArray.length > 0 ? Math.floor((pageWidth - margin * 2 - baseColWidths.reduce((a, b) => a + b, 0)) / categoriesArray.length) : 20;
          const colWidths = [...baseColWidths, ...categoriesArray.map(() => categoryColWidth)];
          const rowHeight = 25;
          let currentRowY = tableStartY;
          
          // Helper function to get severity color for PDF
          const getSeverityColorPDF = (severity: string): [number, number, number] => {
            switch (severity) {
              case 'high': return [220, 53, 69]; // Red
              case 'medium': return [255, 193, 7]; // Yellow
              case 'low': return [253, 126, 20]; // Orange
              case 'none': return [40, 167, 69]; // Green
              default: return [108, 117, 125]; // Gray
            }
          };
          
          // Draw table headers
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setFillColor(66, 139, 202);
          doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
          
          doc.setTextColor(255, 255, 255);
          let currentX = margin + 2;
          const headers = ['Msg ID', 'Analysis', ...categoriesArray.map(cat => formatContentType(cat))];
          headers.forEach((header, index) => {
            // Split header text if too long
            const lines = doc.splitTextToSize(header, colWidths[index] - 4);
            doc.text(lines[0], currentX, currentRowY + 6);
            if (lines.length > 1) {
              doc.text(lines[1], currentX, currentRowY + 12);
            }
            currentX += colWidths[index];
          });
          
          currentRowY += rowHeight;
          
          // Draw table data for messages with flags or analysis
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(6);
          
          const relevantMessages = filteredMessages.filter(msg => 
            msg.flaggingAnalysis || (msg.severityBreakdown && Object.keys(msg.severityBreakdown).length > 0)
          );
          
          relevantMessages.forEach((message, index) => {
            // Check if we need a new page
            if (currentRowY + rowHeight > pageHeight - margin) {
              doc.addPage();
              currentRowY = margin;
            }
            
            // Draw row background (alternating colors)
            if (index % 2 === 0) {
              doc.setFillColor(245, 245, 245);
              doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
            }
            
            currentX = margin + 2;
            
            // Message ID
            const messageIndex = filteredMessages.findIndex(m => m.id === message.id) + 1;
            doc.text(messageIndex.toString(), currentX, currentRowY + 10);
            currentX += colWidths[0];
            
            // Analysis (truncated)
            const analysis = message.flaggingAnalysis?.reasoning || 'No analysis';
            const analysisLines = doc.splitTextToSize(analysis, colWidths[1] - 4);
            doc.text(analysisLines[0], currentX, currentRowY + 6);
            if (analysisLines.length > 1) {
              doc.text(analysisLines[1], currentX, currentRowY + 12);
            }
            currentX += colWidths[1];
            
            // Category columns with color coding
            categoriesArray.forEach((category, catIndex) => {
              const severity = message.severityBreakdown?.[category] || 'none';
              const [r, g, b] = getSeverityColorPDF(severity);
              
              // Draw colored background for severity
              if (severity !== 'none') {
                doc.setFillColor(r, g, b);
                doc.rect(currentX, currentRowY + 2, colWidths[2 + catIndex] - 2, rowHeight - 4, 'F');
              }
              
              // Set text color (white for dark backgrounds, black for light)
              const isDark = (r * 0.299 + g * 0.587 + b * 0.114) < 128;
              doc.setTextColor(isDark ? 255 : 0, isDark ? 255 : 0, isDark ? 255 : 0);
              
              // Draw severity text
              doc.setFontSize(6);
              const severityText = severity.charAt(0).toUpperCase() + severity.slice(1);
              doc.text(severityText, currentX + 2, currentRowY + 10);
              
              // Reset text color
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(6);
              
              currentX += colWidths[2 + catIndex];
            });
            
            // Draw row border
            doc.setDrawColor(200, 200, 200);
            doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'S');
            
            currentRowY += rowHeight;
          });
          
          return currentRowY;
        };
        
        currentY = createFlagsTable() + 10;
      }
      
      // Add principle scoring section if there are principle scores
      const messagesWithPrincipleScoring = messages.filter(msg => msg.principleScoring?.scores);
      if (messagesWithPrincipleScoring.length > 0) {
        currentY += 15;
        addTextWithWrapping('Principle Scoring Analysis:', 14, true);
        currentY += 10;
        
        // Get all principles that have been scored
        const principleMap = new Map<string, { name: string; scores: Array<{ messageId: string; messageIndex: number; score: number; reasoning: string; type: 'user' | 'ai' }> }>();
        
        messagesWithPrincipleScoring.forEach((message, messageIndex) => {
          if (message.principleScoring?.scores) {
            message.principleScoring.scores.forEach(score => {
              if (!principleMap.has(score.principleId)) {
                principleMap.set(score.principleId, { 
                  name: score.principleId.charAt(0).toUpperCase() + score.principleId.slice(1), 
                  scores: [] 
                });
              }
              
              const actualMessageIndex = filteredMessages.findIndex(m => m.id === message.id);
              principleMap.get(score.principleId)!.scores.push({
                messageId: message.id,
                messageIndex: actualMessageIndex + 1,
                score: score.score,
                reasoning: score.reasoning || 'No reasoning provided',
                type: message.type
              });
            });
          }
        });
        
        // Add principle scoring plots
        addTextWithWrapping('Principle Score Trends:', 12, true);
        currentY += 10;
        
        const createPrinciplePlots = () => {
          let plotY = currentY;
          const plotWidth = 160; // Increased width for better visibility
          const plotHeight = 90; // Increased height for better visibility
          const plotX = margin;
          
          Array.from(principleMap.entries()).forEach(([principleId, principleData], index) => {
            // Check if we need a new page - give more space for the plot
            if (plotY + plotHeight + 60 > pageHeight - margin) {
              doc.addPage();
              plotY = margin;
            }
            
            // Draw plot title
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(`${principleData.name} Principle Score Trend`, plotX, plotY);
            plotY += 20;
            
            // Draw plot area
            const plotStartY = plotY;
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.rect(plotX, plotStartY, plotWidth, plotHeight, 'S');
            
            // Draw grid lines and labels
            doc.setDrawColor(240, 240, 240);
            doc.setLineWidth(0.2);
            doc.setFontSize(7);
            
            // Y-axis labels and grid lines (scores from -5 to +5)
            for (let score = -5; score <= 5; score += 2) {
              const y = plotStartY + plotHeight - ((score + 5) / 10) * plotHeight;
              if (score !== -5 && score !== 5) { // Don't draw grid on borders
                doc.line(plotX, y, plotX + plotWidth, y);
              }
              doc.setTextColor(100, 100, 100);
              doc.text(score.toString(), plotX - 10, y + 2);
            }
            
            // Prepare data points for x-axis
            const userScores = principleData.scores.filter(s => s.type === 'user').sort((a, b) => a.messageIndex - b.messageIndex);
            const aiScores = principleData.scores.filter(s => s.type === 'ai').sort((a, b) => a.messageIndex - b.messageIndex);
            const maxMessageIndex = Math.max(...principleData.scores.map(s => s.messageIndex));
            const minMessageIndex = Math.min(...principleData.scores.map(s => s.messageIndex));
            
            // X-axis labels (message indices)
            const messageRange = maxMessageIndex - minMessageIndex;
            const xLabelStep = Math.max(1, Math.floor(messageRange / 5)); // Show max 5 labels
            for (let msgIndex = minMessageIndex; msgIndex <= maxMessageIndex; msgIndex += xLabelStep) {
              const x = messageRange > 0 ? plotX + ((msgIndex - minMessageIndex) / messageRange) * plotWidth : plotX + plotWidth / 2;
              doc.setTextColor(100, 100, 100);
              doc.text(msgIndex.toString(), x - 3, plotStartY + plotHeight + 10);
              
              // Draw vertical grid line
              doc.setDrawColor(240, 240, 240);
              doc.line(x, plotStartY, x, plotStartY + plotHeight);
            }
            
            // Draw zero line more prominently
            const zeroY = plotStartY + plotHeight - (5 / 10) * plotHeight;
            doc.setDrawColor(150, 150, 150);
            doc.setLineWidth(1);
            doc.line(plotX, zeroY, plotX + plotWidth, zeroY);
            doc.setLineWidth(0.1);
            
            // Draw data points and lines
            if (userScores.length > 0) {
              // User scores (blue)
              doc.setDrawColor(59, 130, 246); // Blue
              doc.setFillColor(59, 130, 246);
              
              // Draw user line if more than one point
              if (userScores.length > 1) {
                for (let i = 0; i < userScores.length - 1; i++) {
                  const x1 = messageRange > 0 ? plotX + ((userScores[i].messageIndex - minMessageIndex) / messageRange) * plotWidth : plotX + plotWidth / 2;
                  const y1 = plotStartY + plotHeight - ((userScores[i].score + 5) / 10) * plotHeight;
                  const x2 = messageRange > 0 ? plotX + ((userScores[i + 1].messageIndex - minMessageIndex) / messageRange) * plotWidth : plotX + plotWidth / 2;
                  const y2 = plotStartY + plotHeight - ((userScores[i + 1].score + 5) / 10) * plotHeight;
                  doc.setLineWidth(1.5);
                  doc.line(x1, y1, x2, y2);
                }
              }
              
              // Draw user points
              userScores.forEach(score => {
                const x = messageRange > 0 ? plotX + ((score.messageIndex - minMessageIndex) / messageRange) * plotWidth : plotX + plotWidth / 2;
                const y = plotStartY + plotHeight - ((score.score + 5) / 10) * plotHeight;
                doc.circle(x, y, 2, 'F');
              });
            }
            
            if (aiScores.length > 0) {
              // AI scores (purple)
              doc.setDrawColor(139, 92, 246); // Purple
              doc.setFillColor(139, 92, 246);
              
              // Draw AI line if more than one point
              if (aiScores.length > 1) {
                for (let i = 0; i < aiScores.length - 1; i++) {
                  const x1 = messageRange > 0 ? plotX + ((aiScores[i].messageIndex - minMessageIndex) / messageRange) * plotWidth : plotX + plotWidth / 2;
                  const y1 = plotStartY + plotHeight - ((aiScores[i].score + 5) / 10) * plotHeight;
                  const x2 = messageRange > 0 ? plotX + ((aiScores[i + 1].messageIndex - minMessageIndex) / messageRange) * plotWidth : plotX + plotWidth / 2;
                  const y2 = plotStartY + plotHeight - ((aiScores[i + 1].score + 5) / 10) * plotHeight;
                  doc.setLineWidth(1.5);
                  doc.line(x1, y1, x2, y2);
                }
              }
              
              // Draw AI points
              aiScores.forEach(score => {
                const x = messageRange > 0 ? plotX + ((score.messageIndex - minMessageIndex) / messageRange) * plotWidth : plotX + plotWidth / 2;
                const y = plotStartY + plotHeight - ((score.score + 5) / 10) * plotHeight;
                doc.circle(x, y, 2, 'F');
              });
            }
            
            // Add averages text below the plot
            const userAvg = userScores.length > 0 ? (userScores.reduce((sum, s) => sum + s.score, 0) / userScores.length).toFixed(1) : 'N/A';
            const aiAvg = aiScores.length > 0 ? (aiScores.reduce((sum, s) => sum + s.score, 0) / aiScores.length).toFixed(1) : 'N/A';
            
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text('Averages:', plotX, plotStartY + plotHeight + 15);
            doc.setTextColor(59, 130, 246);
            doc.text(`User: ${userAvg}`, plotX + 40, plotStartY + plotHeight + 15);
            doc.setTextColor(139, 92, 246);
            doc.text(`AI: ${aiAvg}`, plotX + 90, plotStartY + plotHeight + 15);
            
            // Reset colors
            doc.setTextColor(0, 0, 0);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.1);
            
            // Move to next row with proper spacing
            plotY += plotHeight + 40;
          });
          
          return plotY;
        };
        
        currentY = createPrinciplePlots();
        
        // Add legend
        addTextWithWrapping('Legend:', 10, true);
        doc.setFontSize(8);
        doc.setFillColor(59, 130, 246);
        doc.circle(margin + 5, currentY, 2, 'F');
        doc.setTextColor(0, 0, 0);
        doc.text('User Messages', margin + 15, currentY + 2);
        
        doc.setFillColor(139, 92, 246);
        doc.circle(margin + 80, currentY, 2, 'F');
        doc.text('AI Messages', margin + 90, currentY + 2);
        currentY += 15;
        
        // Create principle scoring tables
        const createPrincipleScoreTables = () => {
          let tableY = currentY;
          
          Array.from(principleMap.entries()).forEach(([principleId, principleData]) => {
            // Check if we need a new page
            if (tableY + 100 > pageHeight - margin) {
              doc.addPage();
              tableY = margin;
            }
            
            // Add principle title
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`${principleData.name} Principle`, margin, tableY);
            tableY += 20;
            
            // Calculate average scores
            const userScores = principleData.scores.filter(s => s.type === 'user');
            const aiScores = principleData.scores.filter(s => s.type === 'ai');
            const avgUser = userScores.length > 0 ? (userScores.reduce((sum, s) => sum + s.score, 0) / userScores.length).toFixed(1) : 'N/A';
            const avgAI = aiScores.length > 0 ? (aiScores.reduce((sum, s) => sum + s.score, 0) / aiScores.length).toFixed(1) : 'N/A';
            
            // Add averages
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Average User Score: ${avgUser} | Average AI Score: ${avgAI}`, margin, tableY);
            tableY += 15;
            
            // Create table for this principle
            const colWidths = [30, 20, 20, 100]; // Message ID, Score, Source, Reasoning
            const rowHeight = 20;
            let currentRowY = tableY;
            
            // Draw table headers
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(66, 139, 202);
            doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
            
            doc.setTextColor(255, 255, 255);
            let currentX = margin + 2;
            const headers = ['Message ID', 'Score', 'Source', 'Reasoning'];
            headers.forEach((header, index) => {
              doc.text(header, currentX, currentRowY + 10);
              currentX += colWidths[index];
            });
            
            currentRowY += rowHeight;
            
            // Draw table data
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(7);
            
            principleData.scores.sort((a, b) => a.messageIndex - b.messageIndex).forEach((scoreData, index) => {
              // Check if we need a new page
              if (currentRowY + rowHeight > pageHeight - margin) {
                doc.addPage();
                currentRowY = margin;
              }
              
              // Draw row background (alternating colors)
              if (index % 2 === 0) {
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
              }
              
              currentX = margin + 2;
              
              // Message ID
              doc.text(scoreData.messageIndex.toString(), currentX, currentRowY + 10);
              currentX += colWidths[0];
              
              // Score (with color coding)
              const scoreColor = scoreData.score >= 3 ? [0, 128, 0] : scoreData.score >= 0 ? [255, 165, 0] : [255, 0, 0];
              doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
              doc.text(scoreData.score.toString(), currentX, currentRowY + 10);
              doc.setTextColor(0, 0, 0);
              currentX += colWidths[1];
              
              // Source
              doc.text(scoreData.type === 'user' ? 'Human' : 'AI', currentX, currentRowY + 10);
              currentX += colWidths[2];
              
              // Reasoning (truncated to fit)
              const reasoningLines = doc.splitTextToSize(scoreData.reasoning, colWidths[3] - 4);
              doc.text(reasoningLines[0], currentX, currentRowY + 6);
              if (reasoningLines.length > 1) {
                doc.text(reasoningLines[1], currentX, currentRowY + 12);
              }
              
              // Draw row border
              doc.setDrawColor(200, 200, 200);
              doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'S');
              
              currentRowY += rowHeight;
            });
            
            tableY = currentRowY + 20; // Space between principle tables
          });
          
          return tableY;
        };
        
        currentY = createPrincipleScoreTables();
        
        // Add principle scoring visualization as text summary
        currentY += 10;
        addTextWithWrapping('Principle Scoring Summary:', 12, true);
        
        Array.from(principleMap.entries()).forEach(([principleId, principleData]) => {
          const userScores = principleData.scores.filter(s => s.type === 'user');
          const aiScores = principleData.scores.filter(s => s.type === 'ai');
          const avgUser = userScores.length > 0 ? (userScores.reduce((sum, s) => sum + s.score, 0) / userScores.length).toFixed(1) : 'N/A';
          const avgAI = aiScores.length > 0 ? (aiScores.reduce((sum, s) => sum + s.score, 0) / aiScores.length).toFixed(1) : 'N/A';
          
          const summaryText = `${principleData.name}: User Average: ${avgUser}, AI Average: ${avgAI} (Total scores: ${principleData.scores.length})`;
          addTextWithWrapping(summaryText, 9);
        });
      }
      
      // Save the PDF
      const filename = `ERM_Analysis_${new Date().toISOString().slice(0, 10)}_${Date.now()}.pdf`;
      doc.save(filename);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className='bg-white-100 h-full w-full'>
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="mr-4"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Interactive Mode</h1>
            <p className="text-sm text-gray-600">
              {mode.subMode === 'default-chat' 
                ? 'Chat with a zero-shot LLM' 
                : 'Chat using your custom workflow'}
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-6 pb-6 flex flex-col pt-10">
        <div className="grid grid-cols-4 gap-6 h-[calc(100vh-10rem)] mb-6">
          {/* Left Panel - API Key Input */}
          <div className="col-span-1 overflow-y-auto space-y-4">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>Connect to OpenAI API</CardDescription>
              </CardHeader>
              <CardContent>
                <ApiKeyInput 
                  onApiKeySet={handleApiKeySet}
                  isConnected={isConnected}
                  currentBaseUrl={baseUrl}
                  currentModel={selectedModel}
                />
              </CardContent>
            </Card>
            
            {/* Mode Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  {mode.subMode === 'default-chat' ? (
                    <Bot className="w-5 h-5 mr-2" />
                  ) : (
                    <Workflow className="w-5 h-5 mr-2" />
                  )}
                  {mode.subMode === 'default-chat' ? 'Default Chat' : 'Custom Workflow'}
                </CardTitle>
                <CardDescription>
                  {mode.subMode === 'default-chat' 
                    ? baseUrl ? `Chat using custom endpoint: ${getHostname(baseUrl)}` : 'Chat with OpenAI GPT-3.5-turbo'
                    : baseUrl ? `Using custom endpoint with workflow: ${getHostname(baseUrl)}` : 'Using custom workflow with OpenAI'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mode.subMode === 'custom-workflow' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Upload Workflow File
                      </label>
                      <input
                        type="file"
                        accept=".json,.yaml,.yml"
                        onChange={handleWorkflowUpload}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                    
                    {workflowFile && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-800">
                          Workflow loaded: {workflowFile.name}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Messages</span>
                    <span className="font-medium">{messages.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className={`font-medium ${isConnected ? 'text-green-600' : 'text-orange-600'}`}>
                      {isConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                  {isConnected && baseUrl && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Endpoint</span>
                      <span className="font-medium text-blue-600 text-xs">
                        {getHostname(baseUrl)}
                      </span>
                    </div>
                  )}
                  
                  {mode.subMode === 'default-chat' && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Flags</span>
                        <span className={`font-medium ${flaggedMessages.length > 0 ? 'text-red-600' : 'text-black-600'}`}>
                          {flaggedMessages.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Flagging</span>
                        <button
                          onClick={() => setIsFlaggingEnabled(!isFlaggingEnabled)}
                          className={`text-xs px-2 py-1 rounded ${
                            isFlaggingEnabled 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {isFlaggingEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Principle Scoring</span>
                        <button
                          onClick={() => setIsPrincipleScoringEnabled(!isPrincipleScoringEnabled)}
                          className={`text-xs px-2 py-1 rounded ${
                            isPrincipleScoringEnabled 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {isPrincipleScoringEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Additional Context Panel - Only shown in default chat mode */}
            {mode.subMode === 'default-chat' && (
              <AdditionalContext 
                context={summaryContext}
                onContextChange={setSummaryContext}
              />
            )}
          </div>

          {/* Chat Interface */}
          <div className="col-span-3 flex flex-col">
            <Card className="flex flex-col h-[calc(100vh-10rem)] overflow-hidden">
              <CardHeader className="flex-shrink-0 py-3 px-4">
                <CardTitle className="flex items-center text-lg">
                  <Bot className="w-5 h-5 mr-2" />
                  Chat Interface
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-0 min-h-0">
                {/* Messages Area - Fills remaining space with scroll */}
                <div className="flex-1 overflow-y-auto space-y-4 p-4 scroll-smooth messages-container custom-scrollbar">
                  {messages.length === 0 ? (
                    <div className="flex flex-col h-full items-center justify-center text-gray-500">
                      <div className="bg-blue-50 rounded-full p-6 mb-4">
                        <Bot className="w-12 h-12 text-blue-500" />
                      </div>
                      <h3 className="text-xl font-medium mb-2 text-gray-700">
                        {isConnected ? 'Start a Conversation' : 'Connect API Key'}
                      </h3>
                      {isConnected ? (
                        <p className="text-center max-w-md text-gray-600">
                          Your AI assistant is ready to help. Type a message below to begin the conversation.
                        </p>
                      ) : (
                        <p className="text-center max-w-md text-gray-600">
                          Please connect your OpenAI API key in the sidebar panel to start chatting.
                        </p>
                      )}
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div key={message.id} className="space-y-2 mb-4">
                        <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg shadow-sm ${
                              message.type === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-none'
                                : 'bg-gray-100 text-gray-800 rounded-tl-none'
                            } ${message.flags && message.flags.length > 0 ? 'border-2 border-red-500' : ''}`}
                          >
                            <div className="flex items-center mb-1">
                              {message.type === 'user' ? (
                                <User className="w-4 h-4 mr-2" />
                              ) : (
                                <Bot className="w-4 h-4 mr-2" />
                              )}
                              <span className="text-xs opacity-75">
                                #{index + 1} • {message.timestamp.toLocaleTimeString()}
                              </span>
                              {message.flags && message.flags.length > 0 && (
                                <AlertTriangle className="w-4 h-4 ml-2 text-red-500" />
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                        
                        {/* Show flags if present */}
                        {message.flags && message.flags.length > 0 && (
                          <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-xs lg:max-w-md">
                              {message.flags.map((flag) => (
                                <div
                                  key={flag.id}
                                  className={`px-3 py-2 rounded-lg text-sm border-l-4 my-1 ${
                                    flag.severity === 'high' ? 'bg-red-50 border-red-500 text-red-800' :
                                    flag.severity === 'medium' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' :
                                    'bg-orange-50 border-orange-500 text-orange-800'
                                  }`}
                                >
                                  <div className="flex items-center mb-1">
                                    <Flag className="w-3 h-3 mr-1" />
                                    <span className="font-medium text-xs uppercase">
                                      {flag.type.replace('-', ' ')} - {flag.severity}
                                    </span>
                                  </div>
                                  <p className="text-xs">{flag.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Flagging Analysis - Show if exists */}
                        {message.flaggingAnalysis && (
                          <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-xs lg:max-w-md">
                              <div className="bg-gray-50 border border-gray-200 rounded-lg text-sm my-1">
                                <button
                                  onClick={() => toggleAnalysisExpansion(message.id)}
                                  className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-100 rounded-lg"
                                >
                                  <div className="flex items-center">
                                    <Shield className="w-3 h-3 mr-2 text-blue-600" />
                                    <span className="text-xs font-medium text-gray-700">
                                      Flagging Analysis
                                      {message.flaggingAnalysis.shouldFlag && (
                                        <span className="ml-1 text-red-600 font-bold">⚠</span>
                                      )}
                                    </span>
                                  </div>
                                  {expandedAnalysis.has(message.id) ? (
                                    <ChevronUp className="w-3 h-3 text-gray-500" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 text-gray-500" />
                                  )}
                                </button>
                                
                                {expandedAnalysis.has(message.id) && (
                                  <div className="px-3 pb-3 border-t border-gray-200">
                                    <div className="mt-2">
                                      <p className="text-xs text-gray-600 mb-1">
                                        <strong>Analysis:</strong>
                                      </p>
                                      <p className="text-xs text-gray-700 leading-relaxed">
                                        {message.flaggingAnalysis.reasoning}
                                      </p>
                                      
                                      {message.severityBreakdown && Object.keys(message.severityBreakdown).length > 0 && (
                                        <div className="mt-3 border-t border-gray-200 pt-3">
                                          <div className="flex items-center mb-2">
                                            <BarChart3 className="w-3 h-3 mr-1 text-blue-600" />
                                            <span className="text-xs font-medium text-gray-700">Severity Breakdown</span>
                                          </div>
                                          <div className="grid grid-cols-1 gap-2">
                                            {Object.entries(message.severityBreakdown).map(([type, severity]) => (
                                              <div key={type} className="flex items-center justify-between text-xs">
                                                <span className="text-gray-600 capitalize">
                                                  {formatContentType(type)}
                                                </span>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(severity)}`}>
                                                  {severity}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      <p className="text-xs text-gray-500 mt-3">
                                        Analyzed at {message.flaggingAnalysis.analysisTimestamp.toLocaleTimeString()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  
                  {isTyping && (
                    <div className="flex justify-start animate-fadeIn">
                      <div className="bg-gray-100 text-gray-800 max-w-xs lg:max-w-md px-4 py-3 rounded-lg rounded-tl-none shadow-sm">
                        <div className="flex items-center">
                          <Bot className="w-4 h-4 mr-2 text-blue-600" />
                          <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>
              
              {/* Input Area - Moved to bottom of Chat Interface */}
              <div className="flex-shrink-0 p-4 border-t border-gray-100">
                <div className="flex space-x-2">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={isConnected ? "Type your message..." : "Connect API key to start chatting..."}
                    className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    rows={2}
                    disabled={!isConnected}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || !isConnected || isTyping}
                    className="px-4 self-end h-[42px]"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
        
        <div>
          <div className="mb-4 space-y-4">
                  {/* Message Cutoff Slider */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-md font-bold text-gray-700">
                        Message Range for All Analysis
                      </label>
                      <span className="text-xs text-gray-500">
                        {messageCutoff === 0 ? 'No messages' : `Analyzing messages 1-${messageCutoff} of ${messages.length}`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max={messages.length}
                      value={messageCutoff}
                      onChange={(e) => setMessageCutoff(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      disabled={messages.length === 0}
      
                    />
                    <div className="flex justify-between text-s text-gray-500 mt-1">
                      <span>1</span>
                      <span className="text-center">
                        Include flags up to message #{messageCutoff}
                      </span>
                      <span>{messages.length}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      Affects flags, summary, PDF export, and principle scoring
                    </div>
                  </div>
              </div>
        </div>

        {/* Flags Log Panel - Only shown when in default chat mode and flags exist */}
        {mode.subMode === 'default-chat' && (
          <div className="mt-20">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Flag className="w-5 h-5 mr-2" />
                  Flags Log
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({getFilteredFlags().length} of {(() => {
                      const filteredMsgs = getFilteredMessages();
                      return flaggedMessages.filter(flag => filteredMsgs.some(msg => msg.id === flag.messageId)).length;
                    })()} shown)
                  </span>
                </CardTitle>
                <CardDescription>
                  Consolidated view of all flagged content throughout the conversation
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {/* Filters */}
                  <div>
                  {/* Other Filters */}
                  <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Message Type:</label>
                    <select
                      value={flagsLogFilters.messageType}
                      onChange={(e) => setFlagsLogFilters(prev => ({ ...prev, messageType: e.target.value }))}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="all">All</option>
                      <option value="user">User</option>
                      <option value="ai">AI</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Category:</label>
                    <select
                      value={flagsLogFilters.flagCategory}
                      onChange={(e) => setFlagsLogFilters(prev => ({ ...prev, flagCategory: e.target.value }))}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="all">All</option>
                      {getUniqueCategories().map(category => (
                        <option key={category} value={category}>
                          {formatContentType(category)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Severity:</label>
                    <select
                      value={flagsLogFilters.severityLevel}
                      onChange={(e) => setFlagsLogFilters(prev => ({ ...prev, severityLevel: e.target.value }))}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="all">All</option>
                      {getUniqueSeverities().map(severity => (
                        <option key={severity} value={severity}>
                          {severity.charAt(0).toUpperCase() + severity.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFlagsLogFilters({ messageType: 'all', flagCategory: 'all', severityLevel: 'all' })}
                    className="text-xs"
                  >
                    Clear Filters
                  </Button>
                  </div>
                </div>

                {/* Filtered Flags */}
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {getFilteredFlags().length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Flag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No flags match the current filters</p>
                    </div>
                  ) : (
                    getFilteredFlags().map((flag) => {
                      const flaggedMessage = messages.find(msg => msg.id === flag.messageId);
                      return (
                        <div
                          key={flag.id}
                          className={`p-3 rounded-lg border-l-4 ${
                            flag.severity === 'high' ? 'bg-red-50 border-red-500' :
                            flag.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                            'bg-orange-50 border-orange-500'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <span className={`text-xs px-2 py-1 rounded font-medium ${getSeverityColor(flag.severity)}`}>
                                {flag.severity.toUpperCase()}
                              </span>
                              <span className="ml-2 text-xs text-gray-600 capitalize">
                                {formatContentType(flag.type)}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                {flaggedMessage?.type === 'user' ? 'User' : 'AI'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {flag.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{flag.reason}</p>
                          {flag.flaggedText && (
                            <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
                              <strong>Flagged text:</strong> "{flag.flaggedText}"
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      
        
        {/* Interaction Summary Panel - Only shown when in default chat mode and has messages */}
        {mode.subMode === 'default-chat' && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Interaction Summary
                    {summaryOutput && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        (Bullet Points)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={generateSummary}
                      disabled={!isConnected || isTyping || isSummarizing}
                      className="flex items-center space-x-2"
                      variant="outline"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{isSummarizing ? 'Generating...' : 'Generate Summary'}</span>
                    </Button>
                    <Button
                      onClick={exportAnalysisToPDF}
                      disabled={!isConnected || messages.length === 0 || isExportingPDF}
                      className="flex items-center space-x-2"
                      variant="outline"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isExportingPDF ? 'Exporting...' : 'Export PDF'}</span>
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  AI-generated summary including conversation context and flagged content
                </CardDescription>
              </CardHeader>
              
              {summaryOutput ? (
                <CardContent className="p-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="prose prose-sm max-w-none">
                      <div 
                        className="text-gray-800 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(summaryOutput) }}
                      />
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <div className="flex items-center space-x-4">
                          <span>Messages analyzed: {messages.length}</span>
                          <span>Flags considered: {flaggedMessages.length}</span>
                          <span>Format: Bullet Points</span>
                        </div>
                        <div className="flex items-center">
                          <Sparkles className="w-3 h-3 mr-1" />
                          <span>Generated by AI</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="p-4">
                  <div className="text-center text-gray-500 py-8">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Summary Generated Yet</h3>
                    <p className="text-sm">
                      Click the "Generate Summary" button above to create an AI-powered summary of your conversation.
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}
        
        {/* Principle Scoring Visualization Panel - Only shown when in default chat mode and has principle data */}
        {mode.subMode === 'default-chat' && (
          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Principle Score Visualization
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (Debug: {principleVisualizationData.length} principles, {principleScores.length} scores)
                  </span>
                </CardTitle>
                <CardDescription>
                  Track principle adherence over time for both user and AI messages
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                {principleVisualizationData.length === 0 || principleVisualizationData.every(p => p.userScores.length === 0 && p.aiScores.length === 0) ? (
                  <div className="text-center text-gray-500 py-8">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Principle Data Yet</h3>
                    <p className="text-sm mb-4">
                      {!isPrincipleScoringEnabled ? 
                        'Principle scoring is disabled. Enable it in the sidebar to start tracking.' :
                        'Start a conversation to see principle scoring in action.'
                      }
                    </p>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>Principle Scoring: {isPrincipleScoringEnabled ? 'Enabled' : 'Disabled'}</p>
                      <p>Messages: {messages.length}</p>
                      <p>Scores: {principleScores.length}</p>
                      <p>Viz Data Length: {principleVisualizationData.length}</p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          console.log('Current state debug:', {
                            messages: messages.length,
                            principleScores: principleScores.length,
                            vizDataLength: principleVisualizationData.length,
                            vizData: principleVisualizationData,
                            messagesWithScoring: messages.filter(m => m.principleScoring).length,
                            isConnected,
                            apiKey,
                            isPrincipleScoringEnabled
                          });
                        }}
                        className="mt-2"
                      >
                        Debug State
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={async () => {
                          if (messages.length > 0) {
                            console.log('Force scoring last message...');
                            await scorePrinciples(messages[messages.length - 1], messages);
                          }
                        }}
                        className="mt-1 ml-2"
                      >
                        Force Score
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Shared Legend */}
                    <div className="mb-6 flex items-center justify-center">
                      <div className="bg-white rounded-lg border border-gray-200 px-6 py-3">
                        <div className="flex items-center space-x-6">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                            <span className="text-sm text-gray-700 font-medium">User Messages</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                            <span className="text-sm text-gray-700 font-medium">AI Messages</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Principle Subplots Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {principleVisualizationData.map((principleData) => (
                      <div key={principleData.principleId} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-lg text-gray-800">
                            {principleData.principleName}
                          </h4>
                          <div className="relative group">
                            <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 max-w-64 text-center">
                              {PRINCIPLE_DESCRIPTIONS[principleData.principleId as keyof typeof PRINCIPLE_DESCRIPTIONS]}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Line Plot Visualization */}
                        <div className="space-y-3">
                          {(principleData.userScores.length > 0 || principleData.aiScores.length > 0) ? (
                            <div className="flex items-start gap-4">
                              {/* Chart on the left */}
                              <div className="flex-1 h-100">
                                <svg width="100%" height="100%" viewBox="0 0 320 192" className="border border-gray-200 rounded bg-white">
                                  {/* Grid lines */}
                                  <defs>
                                    <pattern id={`grid-${principleData.principleId}`} width="32" height="19.2" patternUnits="userSpaceOnUse">
                                      <path d="M 32 0 L 0 0 0 19.2" fill="none" stroke="#f3f4f6" strokeWidth="0.5"/>
                                    </pattern>
                                  </defs>
                                  <rect width="320" height="192" fill={`url(#grid-${principleData.principleId})`} />
                                  
                                  {/* Y-axis labels and lines */}
                                  {[-5, -3, -1, 1, 3, 5].map(value => {
                                    const y = 96 - (value * 16); // Center at 96, scale by 16 pixels per point
                                    return (
                                      <g key={value}>
                                        <line x1="25" y1={y} x2="310" y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
                                        <text x="5" y={y + 3} fontSize="10" fill="#6b7280" textAnchor="start">{value}</text>
                                      </g>
                                    );
                                  })}
                                  
                                  {/* Zero line (more prominent) */}
                                  <line x1="25" y1="96" x2="310" y2="96" stroke="#9ca3af" strokeWidth="1.5" />
                                  
                                  {/* Calculate total message count for proper spacing */}
                                  {(() => {
                                    // Find the maximum message index to determine the chart width
                                    const allScores = [...principleData.userScores, ...principleData.aiScores];
                                    const maxMessageIndex = allScores.length > 0 ? 
                                      Math.max(...allScores.map(s => s.messageIndex)) : 0;
                                    const totalMessages = maxMessageIndex + 1;
                                    const xSpacing = totalMessages > 1 ? 260 / (totalMessages - 1) : 0;
                                    
                                    return (
                                      <>
                                        {/* User scores line */}
                                        {principleData.userScores.length > 1 && (
                                          <polyline
                                            points={principleData.userScores
                                              .sort((a, b) => a.messageIndex - b.messageIndex)
                                              .map((score) => {
                                                const x = 35 + (score.messageIndex * xSpacing);
                                                const y = Math.max(8, Math.min(184, 96 - (score.score * 16)));
                                                return `${x},${y}`;
                                              }).join(' ')}
                                            fill="none"
                                            stroke="#3b82f6"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        )}
                                        
                                        {/* User score points */}
                                        {principleData.userScores.map((score) => {
                                          const x = 35 + (score.messageIndex * xSpacing);
                                          const y = Math.max(8, Math.min(184, 96 - (score.score * 16)));
                                          return (
                                            <g key={`user-${score.messageIndex}`}>
                                              <circle
                                                cx={x}
                                                cy={y}
                                                r="4"
                                                fill="#3b82f6"
                                                stroke="white"
                                                strokeWidth="2"
                                                style={{ cursor: 'pointer' }}
                                                onMouseEnter={(e) => {
                                                  const rect = e.currentTarget.getBoundingClientRect();
                                                  setTooltip({
                                                    visible: true,
                                                    x: rect.left + rect.width / 2,
                                                    y: rect.top - 10,
                                                    title: `User Message ${score.messageIndex + 1}: ${score.score}`,
                                                    content: score.reasoning
                                                  });
                                                }}
                                                onMouseLeave={() => {
                                                  setTooltip(prev => ({ ...prev, visible: false }));
                                                }}
                                              />
                                            </g>
                                          );
                                        })}
                                        
                                        {/* AI scores line */}
                                        {principleData.aiScores.length > 1 && (
                                          <polyline
                                            points={principleData.aiScores
                                              .sort((a, b) => a.messageIndex - b.messageIndex)
                                              .map((score) => {
                                                const x = 35 + (score.messageIndex * xSpacing);
                                                const y = Math.max(8, Math.min(184, 96 - (score.score * 16)));
                                                return `${x},${y}`;
                                              }).join(' ')}
                                            fill="none"
                                            stroke="#8b5cf6"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        )}
                                        
                                        {/* AI score points */}
                                        {principleData.aiScores.map((score) => {
                                          const x = 35 + (score.messageIndex * xSpacing);
                                          const y = Math.max(8, Math.min(184, 96 - (score.score * 16)));
                                          return (
                                            <g key={`ai-${score.messageIndex}`}>
                                              <circle
                                                cx={x}
                                                cy={y}
                                                r="4"
                                                fill="#8b5cf6"
                                                stroke="white"
                                                strokeWidth="2"
                                                style={{ cursor: 'pointer' }}
                                                onMouseEnter={(e) => {
                                                  const rect = e.currentTarget.getBoundingClientRect();
                                                  setTooltip({
                                                    visible: true,
                                                    x: rect.left + rect.width / 2,
                                                    y: rect.top - 10,
                                                    title: `AI Message ${score.messageIndex + 1}: ${score.score}`,
                                                    content: score.reasoning
                                                  });
                                                }}
                                                onMouseLeave={() => {
                                                  setTooltip(prev => ({ ...prev, visible: false }));
                                                }}
                                              />
                                            </g>
                                          );
                                        })}
                                      </>
                                    );
                                  })()}
                                  
                                  {/* Chart border */}
                                  <rect x="25" y="8" width="285" height="176" fill="none" stroke="#d1d5db" strokeWidth="1" />
                                </svg>
                              </div>
                              
                              {/* Legend and stats on the right */}
                              <div className="flex flex-col justify-center min-w-0 w-28">
                                {/* Summary stats only */}
                                <div className="space-y-2">
                                  <div className="text-s font-medium text-gray-700 mb-2">Averages</div>
                                  {principleData.userScores.length > 0 && (
                                    <div className="text-ss text-gray-600">
                                      <span className="font-medium text-blue-600">User:</span> {(principleData.userScores.reduce((sum, s) => sum + s.score, 0) / principleData.userScores.length).toFixed(1)}
                                    </div>
                                  )}
                                  {principleData.aiScores.length > 0 && (
                                    <div className="text-s text-gray-600">
                                      <span className="font-medium text-purple-600">AI:</span> {(principleData.aiScores.reduce((sum, s) => sum + s.score, 0) / principleData.aiScores.length).toFixed(1)}
                                    </div>
                                  )}
                                  {principleData.userScores.length === 0 && principleData.aiScores.length === 0 && (
                                    <div className="text-xs text-gray-400">No data</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center text-gray-500 py-8">
                              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No scores for this principle yet</p>
                              <p className="text-xs text-gray-400 mt-1">Line plots will appear as messages are scored</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                )}
                
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <div className="flex items-center space-x-4">
                      <span>Total messages: {messages.length}</span>
                      <span>Total scores: {principleScores.length}</span>
                      <span>Principles: 4</span>
                      <span>Score range: -5 to +5</span>
                    </div>
                    <div className="flex items-center">
                      <BarChart3 className="w-3 h-3 mr-1" />
                      <span>{isPrincipleScoringEnabled ? 'Scoring enabled' : 'Scoring disabled'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
    
    {/* Custom Tooltip */}
    {tooltip.visible && (
      <div
        className="fixed z-50 bg-gray-900 text-white text-s rounded-lg p-3 shadow-lg pointer-events-none max-w-xs"
        style={{
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translate(-50%, -100%)'
        }}
      >
        <div className="font-semibold mb-1">{tooltip.title}</div>
        <div className="text-gray-200 text-wrap">{tooltip.content}</div>
        <div 
          className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
        />
      </div>
    )}
  </div>
  );
}
