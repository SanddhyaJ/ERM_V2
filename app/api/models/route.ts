import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, baseUrl } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required' },
        { status: 400 }
      );
    }

    // Initialize OpenAI with the provided API key and optional base URL
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl || undefined,
    });

    // Fetch available models
    const models = await openai.models.list();

    return NextResponse.json({ 
      models: models.data || []
    });

  } catch (error: unknown) {
    console.error('Models API Error:', error);
    
    // Handle specific OpenAI errors
    if (error instanceof Error && 'status' in error) {
      const openaiError = error as { status: number };
      
      if (openaiError.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your OpenAI API key.' },
          { status: 401 }
        );
      }
      
      if (openaiError.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch models. Please try again.' },
      { status: 500 }
    );
  }
}
