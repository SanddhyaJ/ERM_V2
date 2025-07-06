import { NextRequest, NextResponse } from 'next/server';

interface ConversationMessage {
  role: string;
  content: string;
  timestamp: string;
}

interface FlaggedContent {
  type: string;
  severity: string;
  reason: string;
  flaggedText: string;
}

interface SummaryRequest {
  conversationHistory: ConversationMessage[];
  flaggedContent: FlaggedContent[];
  context: string;
  format: 'paragraph' | 'bullets';
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SummaryRequest = await request.json();
    
    const { 
      conversationHistory, 
      flaggedContent, 
      context, 
      format, 
      apiKey, 
      baseUrl, 
      model = 'gpt-3.5-turbo' 
    } = body;

    console.log('Summary request received:', {
      conversationLength: conversationHistory?.length || 0,
      flagsCount: flaggedContent?.length || 0,
      format,
      model,
      hasApiKey: !!apiKey,
      hasBaseUrl: !!baseUrl
    });

    if (!apiKey) {
      console.error('No API key provided');
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    if (!conversationHistory || conversationHistory.length === 0) {
      console.error('No conversation history provided');
      return NextResponse.json({ error: 'Conversation history is required' }, { status: 400 });
    }

    // Create system prompt for summarizing agent
    const systemPrompt = `You are a conversation summarizing agent. Your task is to analyze the conversation history, flagged content, and any additional context to provide a concise summary.

Context provided by user: ${context || 'No additional context provided'}

Please analyze the conversation and provide a summary in ${format === 'paragraph' ? 'paragraph format' : 'bullet point format'}.

Focus on:
1. Main topics discussed
2. Key decisions or outcomes
3. Any concerning content that was flagged
4. Overall conversation tone and dynamics
5. Any context-specific insights based on the user's provided context

Be concise but comprehensive.`;

    // Prepare the summary request
    const summaryPrompt = `Please summarize this conversation:

CONVERSATION HISTORY:
${conversationHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}

FLAGGED CONTENT:
${flaggedContent.length > 0 ? flaggedContent.map(flag => 
  `- ${flag.type} (${flag.severity}): ${flag.reason} - "${flag.flaggedText}"`
).join('\n') : 'No flagged content'}

ADDITIONAL CONTEXT:
${context || 'None provided'}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: summaryPrompt }
    ];

    // Determine API endpoint
    let apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    if (baseUrl) {
      // If baseUrl is provided, append the chat completions path if not already present
      if (baseUrl.includes('/chat/completions')) {
        apiEndpoint = baseUrl;
      } else {
        apiEndpoint = baseUrl.endsWith('/') ? 
          `${baseUrl}chat/completions` : 
          `${baseUrl}/chat/completions`;
      }
    }
    
    console.log('Making request to:', apiEndpoint);
    
    // Make request to OpenAI API
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API error response:', errorData);
      return NextResponse.json(
        { error: errorData.error?.message || `API request failed with status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('API response data keys:', Object.keys(data));
    
    const summary = data.choices?.[0]?.message?.content || 'No summary generated';
    
    console.log('Summary generated successfully, length:', summary.length, "Value: ", summary);

    return NextResponse.json({ 
      summary,
      timestamp: new Date().toISOString(),
      format,
      conversationLength: conversationHistory.length,
      flagsCount: flaggedContent.length
    });

  } catch (error) {
    console.error('Summary API error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
