import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messages, apiKey, baseUrl, model } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Initialize OpenAI with the provided API key and optional base URL
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl || undefined, // Use default if not provided
    });

    // Make the API call to OpenAI
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const assistantMessage = completion.choices[0]?.message?.content;

    if (!assistantMessage) {
      return NextResponse.json(
        { error: 'No response from OpenAI' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: assistantMessage,
      usage: completion.usage 
    });

  } catch (error: unknown) {
    console.error('OpenAI API Error:', error);
    
    // Handle specific OpenAI errors
    if (error && typeof error === 'object' && 'status' in error) {
      const errorWithStatus = error as { status: number };
      
      if (errorWithStatus.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your OpenAI API key.' },
          { status: 401 }
        );
      }
      
      if (errorWithStatus.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to get response from OpenAI. Please try again.' },
      { status: 500 }
    );
  }
}
