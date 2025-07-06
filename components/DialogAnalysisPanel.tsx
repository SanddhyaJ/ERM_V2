'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload, Bot, User, FileText, AlertTriangle, Flag, ChevronDown, ChevronUp, Shield, BarChart3, Download } from 'lucide-react';
import { FlaggedContent, FlaggingAnalysis, PrincipleScore, PrincipleScoring, PrincipleVisualizationData } from '@/app/types';
import ApiKeyInput from './ApiKeyInput';
import AdditionalContext from './AdditionalContext';

interface DialogAnalysisPanelProps {
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

export default function DialogAnalysisPanel({ onBack }: DialogAnalysisPanelProps) {
  // Principle descriptions for tooltips
  const PRINCIPLE_DESCRIPTIONS = {
    transparency: 'Evaluates how open, honest, and clear the communication is about intentions, limitations, and processes.',
    respect: 'Assesses the level of dignity, courtesy, and consideration shown towards all individuals and their perspectives.',
    accountability: 'Measures the degree to which responsibility is taken for actions, decisions, and their consequences.',
    fairness: 'Evaluates the impartiality, justice, and equitable treatment in responses and recommendations.'
  };

  // Basic state management
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [flaggedMessages, setFlaggedMessages] = useState<FlaggedContent[]>([]);
  const [isFlaggingEnabled, setIsFlaggingEnabled] = useState(true);
  const [expandedAnalysis, setExpandedAnalysis] = useState<Set<string>>(new Set());
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  
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

  // File upload handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsParsingFile(true);

    try {
      const text = await file.text();
      const parsedMessages = parseConversationFile(text);
      setMessages(parsedMessages);
      console.log('Parsed messages:', parsedMessages);
    } catch (error) {
      console.error('Error parsing file:', error);
    } finally {
      setIsParsingFile(false);
    }
  };

  const parseConversationFile = (text: string): Message[] => {
    const lines = text.split('\n');
    const messages: Message[] = [];
    let currentMessage = '';
    let currentType: 'user' | 'ai' | null = null;
    let messageIndex = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }

      // Check for USER: or AI: prefixes (case insensitive)
      const userMatch = trimmedLine.match(/^(user|USER):\s*(.*)$/i);
      const aiMatch = trimmedLine.match(/^(ai|AI):\s*(.*)$/i);

      if (userMatch) {
        // Save previous message if exists
        if (currentMessage && currentType) {
          messages.push({
            id: `msg-${messageIndex}`,
            type: currentType,
            content: currentMessage.trim(),
            timestamp: new Date(Date.now() - (messages.length * 60000)) // 1 minute apart
          });
          messageIndex++;
        }
        
        // Start new user message
        currentType = 'user';
        currentMessage = userMatch[2];
      } else if (aiMatch) {
        // Save previous message if exists
        if (currentMessage && currentType) {
          messages.push({
            id: `msg-${messageIndex}`,
            type: currentType,
            content: currentMessage.trim(),
            timestamp: new Date(Date.now() - (messages.length * 60000)) // 1 minute apart
          });
          messageIndex++;
        }
        
        // Start new AI message
        currentType = 'ai';
        currentMessage = aiMatch[2];
      } else {
        // This is a continuation of the current message (multi-line)
        if (currentMessage) {
          currentMessage += '\n' + trimmedLine;
        }
      }
    }

    // Don't forget the last message
    if (currentMessage && currentType) {
      messages.push({
        id: `msg-${messageIndex}`,
        type: currentType,
        content: currentMessage.trim(),
        timestamp: new Date(Date.now() - (messages.length * 60000))
      });
    }

    return messages;
  };

  const analyzeMessage = async (message: Message, allMessages: Message[]) => {
    if (!isFlaggingEnabled || !isConnected) {
      console.log('Skipping analysis:', { 
        flaggingEnabled: isFlaggingEnabled, 
        connected: isConnected,
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
        
        const analysis: FlaggingAnalysis = {
          id: `analysis-${Date.now()}-${Math.random()}`,
          messageId: message.id,
          shouldFlag: flaggingResult.shouldFlag || false,
          flags: flaggingResult.flags || [],
          reasoning: flaggingResult.reasoning || 'No reasoning provided',
          analysisTimestamp: new Date()
        };

        console.log('Flagging analysis result:', analysis);

        // Update the message with the analysis
        const updatedMessages = allMessages.map(msg => 
          msg.id === message.id 
            ? { 
                ...msg, 
                flaggingAnalysis: analysis, 
                flags: flaggingResult.flags || [],
                severityBreakdown: flaggingResult.severityBreakdown || {}
              }
            : msg
        );

        setMessages(updatedMessages);
        
        // Update flagged messages if any flags were found
        if (flaggingResult.flags && flaggingResult.flags.length > 0) {
          setFlaggedMessages(prev => [...prev, ...flaggingResult.flags]);
        }

        // Update principle visualization data
        if (updatedMessages.length > 0) {
          updatePrincipleVisualizationData(updatedMessages);
        }

        console.log('Analysis complete for message:', {
          messageId: message.id,
          shouldFlag: analysis.shouldFlag,
          flagsCount: analysis.flags.length,
          allMessagesCount: allMessages.length
        });

      } else {
        console.error('Error analyzing message:', await response.text());
      }
    } catch (error) {
      console.error('Error analyzing message:', error);
    }
  };

  const scorePrinciples = async (message: Message, allMessages: Message[]) => {
    if (!isPrincipleScoringEnabled || !isConnected) {
      console.log('Skipping principle scoring:', { 
        enabled: isPrincipleScoringEnabled, 
        connected: isConnected,
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
      // Include context around the message being scored
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
          contextMessagesLength: contextMessages.length,
          messageType: message.type,
          messageContent: message.content.substring(0, 200) + '...'
        }),
      });

      if (response.ok) {
        const scoringResult = await response.json();
        
        const principleScoring: PrincipleScoring = {
          id: `scoring-${Date.now()}-${Math.random()}`,
          messageId: message.id,
          scores: scoringResult.scores || [],
          analysisTimestamp: new Date()
        };

        console.log('Principle scoring result:', principleScoring);

        // Update the message with principle scoring
        const updatedMessages = allMessages.map(msg => 
          msg.id === message.id 
            ? { 
                ...msg, 
                principleScoring: principleScoring
              }
            : msg
        );

        setMessages(updatedMessages);
        
        // Update principle scores
        if (scoringResult.scores && scoringResult.scores.length > 0) {
          setPrincipleScores(prev => [...prev, ...scoringResult.scores]);
        }

        // Update principle visualization data
        if (updatedMessages.length > 0) {
          console.log('About to update viz data with messages:', updatedMessages.length);
          updatePrincipleVisualizationData(updatedMessages);
        }

        console.log('Principle scoring complete for message:', {
          messageId: message.id,
          scoresCount: principleScoring.scores.length
        });

      } else {
        console.error('Error scoring principles:', await response.text());
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

    setPrincipleVisualizationData(vizData);
    
    console.log('Updated principle visualization data:', {
      principles: vizData.length,
      messagesWithScoring: allMessages.filter(m => m.principleScoring).length,
      totalMessages: allMessages.length,
      vizData: vizData.map(v => ({
        principle: v.principleName,
        userScores: v.userScores.length,
        aiScores: v.aiScores.length
      }))
    });
  };

  // Handle connection state changes
  useEffect(() => {
    const checkConnection = () => {
      if (apiKey && selectedModel) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    };

    checkConnection();
  }, [apiKey, selectedModel]);

  // Auto-analyze messages when flagging is enabled and connected
  useEffect(() => {
    if (isFlaggingEnabled && isConnected && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && !lastMessage.flaggingAnalysis) {
        console.log('Auto-analyzing last message:', lastMessage.id);
        analyzeMessage(lastMessage, messages);
      }
    }
  }, [messages, isFlaggingEnabled, isConnected]);

  // Auto-score principles when enabled and connected
  useEffect(() => {
    if (isPrincipleScoringEnabled && isConnected && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && !lastMessage.principleScoring) {
        console.log('Auto-scoring principles for last message:', lastMessage.id);
        scorePrinciples(lastMessage, messages);
      }
    }
  }, [messages, isPrincipleScoringEnabled, isConnected]);

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
    return categories;
  };

  // Get unique severity levels for the filter dropdown
  const getUniqueSeverities = () => {
    const severities = [...new Set(flaggedMessages.map(flag => flag.severity))];
    return severities;
  };

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

      console.log('Sending summary request:', {
        messagesCount: conversationHistory.length,
        flaggedCount: flaggedContent.length,
        hasContext: !!summaryContext
      });

      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        setSummaryOutput(result.summary || 'No summary generated');
        console.log('Summary generated successfully');
      } else {
        const errorText = await response.text();
        console.error('Summary generation failed:', errorText);
        setSummaryOutput('Error generating summary: ' + errorText);
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setSummaryOutput('Error generating summary: ' + String(error));
    } finally {
      setIsSummarizing(false);
    }
  };

  // Run analysis on all messages when API is connected
  const runAnalysisOnAllMessages = async () => {
    if (!isConnected || messages.length === 0) {
      console.log('Cannot run analysis - not connected or no messages');
      return;
    }

    console.log('Running analysis on all messages...');
    
    for (const message of messages) {
      if (!message.flaggingAnalysis && isFlaggingEnabled) {
        await analyzeMessage(message, messages);
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (!message.principleScoring && isPrincipleScoringEnabled) {
        await scorePrinciples(message, messages);
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('Analysis complete for all messages');
  };

  // Format content type for display
  const formatContentType = (type: string) => {
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Toggle analysis expansion
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

  // Show tooltip
  const showTooltip = (e: React.MouseEvent, title: string, content: string) => {
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      title,
      content
    });
  };

  // Hide tooltip
  const hideTooltip = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // PDF export functionality (same as InteractivePanel)
  const exportAnalysisToPDF = async () => {
    if (!isConnected || messages.length === 0) {
      alert('Please connect to API and upload a conversation file to export analysis.');
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

      // Add header
      addTextWithWrapping('Ethics Reasoning Module Dialog Analysis', 18, true);
      addTextWithWrapping(`Generated on: ${new Date().toLocaleString()}`, 12);
      addTextWithWrapping(`Total Messages Analyzed: ${filteredMessages.length}`, 12);
      
      // Add summary if available
      if (summaryOutput) {
        currentY += 10;
        addTextWithWrapping('Analysis Summary:', 14, true);
        addTextWithWrapping(summaryOutput, 10);
      }

      // Add messages table
      currentY += 15;
      addTextWithWrapping('Message Log:', 14, true);
      currentY += 10;
      
      const createSimpleTable = () => {
        const colWidths = [20, 100, 30, 30]; // ID, Content, Type, Timestamp
        const rowHeight = 15;
        let currentRowY = currentY;
        
        // Draw table headers
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(66, 139, 202);
        doc.rect(margin, currentRowY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
        
        doc.setTextColor(255, 255, 255);
        let currentX = margin + 2;
        const headers = ['ID', 'Content', 'Source', 'Timestamp'];
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
        
        // Similar implementation as InteractivePanel...
        // (truncated for brevity - you can add the full flagged content table here)
      }

      // Save the PDF
      doc.save('dialog-analysis-report.pdf');
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF: ' + String(error));
    } finally {
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
            <h1 className="text-2xl font-bold text-gray-900">Dialog Analysis Mode</h1>
            <p className="text-sm text-gray-600">
              Upload conversation logs to analyze AI interactions
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 px-6 pb-6 flex flex-col pt-10">
        <div className="grid grid-cols-4 gap-6 h-[calc(100vh-10rem)] mb-6">
          {/* Left Panel - File Upload */}
          <div className="col-span-1 overflow-y-auto space-y-4">


            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Conversation</CardTitle>
                <CardDescription>Upload a text file with conversation logs</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-sm text-gray-600 mb-2">
                    Drag and drop a conversation file here, or click to browse
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Format: USER: message\\nAI: response
                  </p>
                  <input
                    type="file"
                    accept=".txt,.log"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('file-upload')?.click()}
                    disabled={isParsingFile}
                  >
                    {isParsingFile ? 'Parsing...' : 'Choose File'}
                  </Button>
                </div>
                
                {uploadedFile && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <FileText className="inline h-4 w-4 mr-1" />
                      {uploadedFile.name}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {messages.length} messages parsed
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>Connect to OpenAI API for analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <ApiKeyInput
                  onApiKeySet={(key, url, model) => {
                    setApiKey(key);
                    setBaseUrl(url || '');
                    setSelectedModel(model || '');
                  }}
                  isConnected={isConnected}
                  currentBaseUrl={baseUrl}
                  currentModel={selectedModel}
                />
              </CardContent>
            </Card>

            {/* Analysis Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Analysis Controls</CardTitle>
                <CardDescription>Configure analysis settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Flag Analysis</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFlaggingEnabled(!isFlaggingEnabled)}
                    className={isFlaggingEnabled ? 'bg-green-50 border-green-200' : ''}
                  >
                    {isFlaggingEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Principle Scoring</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPrincipleScoringEnabled(!isPrincipleScoringEnabled)}
                    className={isPrincipleScoringEnabled ? 'bg-green-50 border-green-200' : ''}
                  >
                    {isPrincipleScoringEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {isConnected && messages.length > 0 && (
                  <Button
                    onClick={runAnalysisOnAllMessages}
                    className="w-full"
                    size="sm"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Analyze All Messages
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Additional Context */}
            <AdditionalContext
              context={summaryContext}
              onContextChange={setSummaryContext}
            />
          </div>

          {/* Chat Interface */}
          <div className="col-span-3 flex flex-col">
            <Card className="flex flex-col h-[calc(100vh-10rem)] overflow-hidden">
              <CardHeader className="flex-shrink-0 py-3 px-4">
                <CardTitle className="flex items-center text-lg">
                  <Bot className="w-5 h-5 mr-2" />
                  Conversation Analysis
                  {messages.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({messages.length} messages)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-0 min-h-0">
                {/* Messages Area - Fills remaining space with scroll */}
                <div className="flex-1 overflow-y-auto space-y-4 p-4 scroll-smooth messages-container custom-scrollbar">
                  {messages.length === 0 ? (
                    <div className="flex flex-col h-full items-center justify-center text-gray-500">
                      <div className="bg-blue-50 rounded-full p-6 mb-4">
                        <Upload className="w-12 h-12 text-blue-500" />
                      </div>
                      <h3 className="text-xl font-medium mb-2 text-gray-700">
                        Upload Conversation File
                      </h3>
                      <p className="text-center max-w-md text-gray-600">
                        Upload a conversation log file to begin analysis. The file should contain USER: and AI: prefixed messages.
                      </p>
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
                                #{index + 1}
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
                                  <p>{flag.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Show principle scoring if present */}
                        {message.principleScoring && message.principleScoring.scores.length > 0 && (
                          <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-xs lg:max-w-md">
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-blue-800 flex items-center">
                                    <BarChart3 className="w-3 h-3 mr-1" />
                                    Principle Scores
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleAnalysisExpansion(message.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    {expandedAnalysis.has(message.id) ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </Button>
                                </div>
                                
                                <div className="space-y-1">
                                  {message.principleScoring.scores.map((score) => (
                                    <div key={score.principleId} className="flex justify-between items-center">
                                      <span 
                                        className="text-blue-700 capitalize cursor-help"
                                        onMouseEnter={(e) => showTooltip(
                                          e, 
                                          score.principleId.charAt(0).toUpperCase() + score.principleId.slice(1), 
                                          PRINCIPLE_DESCRIPTIONS[score.principleId as keyof typeof PRINCIPLE_DESCRIPTIONS]
                                        )}
                                        onMouseLeave={hideTooltip}
                                      >
                                        {score.principleId}:
                                      </span>
                                      <span className={`font-medium ${
                                        score.score >= 3 ? 'text-green-600' : 
                                        score.score >= 0 ? 'text-yellow-600' : 
                                        'text-red-600'
                                      }`}>
                                        {score.score > 0 ? '+' : ''}{score.score}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                
                                {expandedAnalysis.has(message.id) && (
                                  <div className="mt-3 pt-2 border-t border-blue-200">
                                    {message.principleScoring.scores.map((score) => (
                                      <div key={`${score.principleId}-detail`} className="mb-2 last:mb-0">
                                        <div className="font-medium text-blue-800 text-xs mb-1 capitalize">
                                          {score.principleId} Reasoning:
                                        </div>
                                        <div className="text-blue-700 text-xs">
                                          {score.reasoning || 'No reasoning provided'}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Analysis Panels */}
        {messages.length > 0 && (
          <div className="mt-4 space-y-6">
            {/* Flags Log Panel */}
            {flaggedMessages.length > 0 && (
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
                  <div className="mb-4 space-y-4">
                    {/* Message Cutoff Slider */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">
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
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
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
                            className={`p-4 rounded-lg border-l-4 ${
                              flag.severity === 'high' ? 'bg-red-50 border-red-500' :
                              flag.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                              'bg-orange-50 border-orange-500'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <Flag className="w-4 h-4" />
                                <span className="font-medium text-sm uppercase">
                                  {flag.type.replace('-', ' ')} - {flag.severity}
                                </span>
                                {flaggedMessage && (
                                  <span className="text-xs text-gray-500">
                                    from {flaggedMessage.type === 'user' ? 'User' : 'AI'} message
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">
                                {flag.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm mb-2">{flag.reason}</p>
                            {flag.flaggedText && (
                              <div className="text-xs text-gray-600 bg-white bg-opacity-50 p-2 rounded italic">
                                "{flag.flaggedText}"
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Interaction Summary Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Analysis Summary
                    {summaryOutput && (
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        (Generated)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={generateSummary}
                      disabled={!isConnected || isSummarizing}
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
                        dangerouslySetInnerHTML={{ 
                          __html: summaryOutput.replace(/\n/g, '<br />') 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="p-4">
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Generate a summary to see conversation insights</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}

        {/* Tooltip */}
        {tooltip.visible && (
          <div 
            className="fixed z-50 bg-gray-900 text-white text-xs rounded py-2 px-3 pointer-events-none max-w-xs"
            style={{ 
              left: tooltip.x - 100, 
              top: tooltip.y - 60,
              transform: 'translateY(-100%)'
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
    </div>
    </div>
  );
}
