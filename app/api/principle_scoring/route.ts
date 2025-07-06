import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

// Dummy principles for initial implementation
const PRINCIPLES = [
  {
    id: 'transparency',
    name: 'Transparency',
    description: 'Evaluates how open, honest, and clear the communication is about intentions, limitations, and processes.'
  },
  {
    id: 'respect',
    name: 'Respect',
    description: 'Assesses the level of dignity, courtesy, and consideration shown towards all individuals and their perspectives.'
  },
  {
    id: 'accountability',
    name: 'Accountability',
    description: 'Measures the degree to which responsibility is taken for actions, decisions, and their consequences.'
  },
  {
    id: 'fairness',
    name: 'Fairness',
    description: 'Evaluates the impartiality, justice, and equitable treatment in responses and recommendations.'
  }
];

export async function POST(request: NextRequest) {
  try {
    const { messages, apiKey, baseUrl, model, additionalContext } = await request.json();

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

    // Get the most recent message (the one being analyzed)
    const currentMessage = messages[messages.length - 1];
    if (!currentMessage) {
      return NextResponse.json(
        { error: 'No message to analyze' },
        { status: 400 }
      );
    }

    const currentRole = currentMessage.role;
    const currentContent = currentMessage.content;

    // Check if this is a test/demo mode
    const isTestMode = apiKey === 'test' || apiKey === 'demo';
    
    // Initialize OpenAI with the provided API key and optional base URL
    let openai;
    if (!isTestMode) {
      openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseUrl || undefined,
      });
    }

    // Create a conversation context for principle analysis
    const conversationContext = messages.slice(-10).map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    console.log('Principle scoring API called with:', {
      messageCount: messages?.length || 0,
      currentMessage: currentContent.substring(0, 100) + '...',
      currentRole: currentRole,
      analyzing: `${currentRole} message + conversation context`,
      contextLength: conversationContext.length,
      hasAdditionalContext: !!additionalContext,
      isTestMode
    });

    // Score each principle
    const scores = [];
    
    for (const principle of PRINCIPLES) {
      try {
        let score, reasoning;
        
        if (isTestMode) {
          // Provide mock scores for testing
          const mockScores = {
            'transparency': Math.floor(Math.random() * 11) - 5, // -5 to 5
            'respect': Math.floor(Math.random() * 11) - 5,
            'accountability': Math.floor(Math.random() * 11) - 5,
            'fairness': Math.floor(Math.random() * 11) - 5
          };
          
          score = mockScores[principle.id as keyof typeof mockScores] || 0;
          reasoning = `Mock evaluation for ${principle.name}: Score ${score} based on simulated analysis of the message content.`;
          
          console.log(`Mock scoring for ${principle.id}: ${score}`);
        } else {
          // Ensure we have an OpenAI instance for real API calls
          if (!openai) {
            throw new Error('OpenAI instance not initialized');
          }
          
          // Principle evaluation system prompt
          const principlePrompt = `You are an expert evaluator assessing conversation messages based on specific ethical principles.

PRINCIPLE TO EVALUATE:
Name: ${principle.name}
Description: ${principle.description}

FULL CONVERSATION HISTORY:
${conversationContext}

CURRENT MESSAGE BEING ANALYZED:
${currentRole}: ${currentContent}

${additionalContext ? `
ADDITIONAL CONTEXT PROVIDED BY USER:
${additionalContext}

Consider this additional context when analyzing the message. This context may provide domain-specific information, situational background, or other relevant details that could affect the scoring.
` : ''}

ANALYSIS INSTRUCTIONS:
1. Analyze the CURRENT MESSAGE specifically for adherence to the principle "${principle.name}"
2. Consider the FULL CONVERSATION HISTORY to understand context and patterns
3. ${additionalContext ? 'Use the ADDITIONAL CONTEXT to better understand the situation and make more informed scoring decisions' : ''}

SCORING SCALE:
- -5 = Complete disregard for this principle
- -4 = Strong violation of this principle
- -3 = Moderate violation of this principle
- -2 = Slight violation of this principle
- -1 = Minor concern regarding this principle
- 0 = Neutral/No relevance to this principle
- 1 = Minor positive regard for this principle
- 2 = Slight adherence to this principle
- 3 = Moderate adherence to this principle
- 4 = Strong adherence to this principle
- 5 = Exceptional embodiment of this principle

Your response will be automatically structured according to the defined schema.`;

          // Define the JSON Schema for structured output
          const principleSchema = {
            type: "object",
            properties: {
              score: {
                type: "integer",
                minimum: -5,
                maximum: 5,
                description: "Numerical score from -5 to 5 for the principle"
              },
              reasoning: {
                type: "string",
                description: "Detailed explanation for the score"
              }
            },
            required: ["score", "reasoning"],
            additionalProperties: false
          };

          // Make the API call to analyze the message for this principle
          let completion;
          try {
            // Try structured output first (requires newer models)
            completion = await openai.chat.completions.create({
              model: model || 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: principlePrompt },
                { role: 'user', content: `Evaluate the message above for adherence to the principle "${principle.name}".` }
              ],
              max_tokens: 500,
              temperature: 0.1,
              response_format: { 
                type: "json_schema",
                json_schema: {
                  name: "principle_evaluation",
                  schema: principleSchema,
                  strict: true
                }
              }
            });
          } catch (schemaError) {
            console.log(`Structured output not supported for principle ${principle.id}, falling back to json_object format`);
            // Fallback to basic JSON object format
            completion = await openai.chat.completions.create({
              model: model || 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: principlePrompt + '\n\nIMPORTANT: Respond with valid JSON only, no markdown or additional text.' },
                { role: 'user', content: `Evaluate the message above for adherence to the principle "${principle.name}". Return valid JSON only.` }
              ],
              max_tokens: 500,
              temperature: 0.1,
              response_format: { type: "json_object" }
            });
          }

          const principleResponse = completion.choices[0]?.message?.content;

          if (!principleResponse) {
            console.error(`No response from principle evaluation for ${principle.id}`);
            score = 0;
            reasoning = 'No response from evaluation system';
          } else {
            // Parse the principle response
            try {
              // First try direct JSON parsing
              const principleResult = JSON.parse(principleResponse);
              
              // Validate and normalize the score
              score = Math.max(-5, Math.min(5, parseInt(principleResult.score) || 0));
              reasoning = principleResult.reasoning || 'No reasoning provided';
              
            } catch (parseError) {
              console.error(`Failed to parse structured principle response for ${principle.id}:`, parseError);
              console.error('Raw response:', principleResponse);
              
              // Try to extract JSON from potentially malformed response
              try {
                let jsonString = principleResponse.trim();
                
                // Remove markdown code blocks if present
                if (jsonString.startsWith('```json')) {
                  jsonString = jsonString.replace(/```json\s*/, '').replace(/```\s*$/, '');
                } else if (jsonString.startsWith('```')) {
                  jsonString = jsonString.replace(/```\s*/, '').replace(/```\s*$/, '');
                }
                
                // Try to find JSON object in the response
                const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  jsonString = jsonMatch[0];
                }
                
                // Try to clean up common JSON issues
                jsonString = jsonString
                  .replace(/,\s*}/g, '}')  // Remove trailing commas
                  .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
                  .replace(/\n/g, ' ')     // Replace newlines with spaces
                  .replace(/\s+/g, ' ');   // Normalize whitespace
                
                const principleResult = JSON.parse(jsonString);
                score = Math.max(-5, Math.min(5, parseInt(principleResult.score) || 0));
                reasoning = principleResult.reasoning || 'Analysis completed successfully.';
                
              } catch (secondParseError) {
                console.error(`Failed to parse cleaned JSON for principle ${principle.id}:`, secondParseError);
                
                // Final fallback
                score = 0;
                reasoning = `Analysis completed with parsing error: ${principleResponse.substring(0, 100)}...`;
              }
            }
          }
        }
        
        // Always add a score (either real or fallback)
        scores.push({
          principleId: principle.id,
          principleName: principle.name,
          score,
          reasoning,
        });

      } catch (error) {
        console.error(`Error evaluating principle ${principle.id}:`, error);
        // Add a fallback score if evaluation fails
        scores.push({
          principleId: principle.id,
          principleName: principle.name,
          score: 0,
          reasoning: `Error evaluating principle: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    console.log('Principle scoring completed:', {
      principlesEvaluated: scores.length,
      scores: scores.map(s => ({ principle: s.principleName, score: s.score }))
    });

    return NextResponse.json({
      success: true,
      scores,
      principles: PRINCIPLES,
      messageRole: currentRole,
      evaluatedAt: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Principle scoring API Error:', error);
    
    // Handle specific OpenAI errors
    if (error instanceof Error && 'status' in error) {
      const openaiError = error as { status: number };
      
      if (openaiError.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key for principle scoring system.' },
          { status: 401 }
        );
      }
      
      if (openaiError.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded for principle scoring system.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to analyze content for principle scores.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    principles: PRINCIPLES,
    description: 'Principle scoring API - evaluates messages based on predefined principles'
  });
}
