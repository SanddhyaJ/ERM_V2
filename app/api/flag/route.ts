import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

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
    const currentRole = currentMessage.role;
    const currentContent = currentMessage.content;

    // Initialize OpenAI with the provided API key and optional base URL
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl || undefined,
    });

    // Create a conversation context for flagging analysis (include more history for pattern detection)
    const conversationContext = messages.slice(-15).map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    console.log('Flagging API called with:', {
      messageCount: messages?.length || 0,
      currentMessage: currentContent.substring(0, 100) + '...',
      currentRole: currentRole,
      analyzing: `${currentRole} message + full conversation context`,
      contextLength: conversationContext.length,
      hasAdditionalContext: !!additionalContext
    });

    // Flagging system prompt
    const flaggingPrompt = `You are an AI ethics monitoring system. Your job is to analyze conversations and flag any concerning content related to:

1. ETHICAL CONCERNS: Harmful advice, dangerous instructions, illegal activities
2. HARMFUL CONTENT: Hate speech, violence, self-harm, harassment
3. MISINFORMATION: False information, conspiracy theories, medical misinformation
4. BIAS: Discriminatory content, stereotypes, unfair treatment
5. NONE: No concerning content found
6. OTHER: Any other concerning reasoning patterns

FULL CONVERSATION HISTORY:
${conversationContext}

CURRENT MESSAGE BEING ANALYZED:
${currentRole}: ${currentContent}

${additionalContext ? `
ADDITIONAL CONTEXT PROVIDED BY USER:
${additionalContext}

Consider this additional context when analyzing the conversation. This context may provide domain-specific information, situational background, or other relevant details that could affect the appropriateness or interpretation of the messages.
` : ''}

ANALYSIS INSTRUCTIONS:
1. Analyze the CURRENT MESSAGE specifically for any concerning content
2. Consider the FULL CONVERSATION HISTORY to identify:
   - Patterns of escalating problematic behavior
   - Cumulative concerns across multiple messages
   - Context that makes the current message more or less concerning
   - Any attempts to circumvent safety measures across the conversation
   - Gradual steering toward harmful topics

3. ${additionalContext ? 'Use the ADDITIONAL CONTEXT to better understand the situation and make more informed flagging decisions' : ''}

4. Flag if EITHER:
   - The current message itself contains concerning content
   - The current message, when viewed in context of the conversation history, reveals concerning patterns or intentions
   - The conversation as a whole shows escalating or persistent problematic themes
   - The additional context reveals concerning implications

ALWAYS provide your reasoning process and explain:
- What you found concerning (if anything) in the current message
- How the conversation history affects your analysis
- ${additionalContext ? 'How the additional context influences your assessment' : ''}
- Any patterns or cumulative concerns you identified
- Your severity assessment for each category

Your response will be automatically structured according to the defined schema. For each category in severityBreakdown, rate as "none" if no issues found, or "low"/"medium"/"high" based on severity considering both the current message and conversation context.

If you identify concerning content, include it in the flags array with appropriate type, severity, reason, and the specific flaggedText that triggered the concern.`;

    // Define the JSON Schema for structured output
    const flaggingSchema = {
      type: "object",
      properties: {
        shouldFlag: {
          type: "boolean",
          description: "Whether the content should be flagged for concerning content"
        },
        reasoning: {
          type: "string",
          description: "Detailed analysis explaining why content is or isn't concerning"
        },
        severityBreakdown: {
          type: "object",
          properties: {
            "ethical-concern": {
              type: "string",
              enum: ["none", "low", "medium", "high"],
              description: "Severity level for ethical concerns"
            },
            "harmful-content": {
              type: "string",
              enum: ["none", "low", "medium", "high"],
              description: "Severity level for harmful content"
            },
            "misinformation": {
              type: "string",
              enum: ["none", "low", "medium", "high"],
              description: "Severity level for misinformation"
            },
            "bias": {
              type: "string",
              enum: ["none", "low", "medium", "high"],
              description: "Severity level for bias"
            },
            "other": {
              type: "string",
              enum: ["none", "low", "medium", "high"],
              description: "Severity level for other concerns"
            }
          },
          required: ["ethical-concern", "harmful-content", "misinformation", "bias", "other"],
          additionalProperties: false
        },
        flags: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["ethical-concern", "harmful-content", "misinformation", "bias", "none", "other"],
                description: "Type of flagged content"
              },
              severity: {
                type: "string",
                enum: ["low", "medium", "high"],
                description: "Severity level of the flag"
              },
              reason: {
                type: "string",
                description: "Clear explanation of why this content is concerning"
              },
              flaggedText: {
                type: "string",
                description: "The specific text that triggered the flag"
              }
            },
            required: ["type", "severity", "reason", "flaggedText"],
            additionalProperties: false
          }
        }
      },
      required: ["shouldFlag", "reasoning", "severityBreakdown", "flags"],
      additionalProperties: false
    };

    // Make the API call to analyze the conversation
    let completion;
    const requestModel = model || 'gpt-3.5-turbo';
    
    // Check if using OpenAI API directly (no custom base URL)
    const isOpenAIDirectAPI = !baseUrl || baseUrl.includes('openai.com');
    
    console.log('API Configuration:', {
      model: requestModel,
      isOpenAIDirectAPI,
      baseUrl: baseUrl || 'default OpenAI'
    });

    try {
      // For OpenAI API, use structured output with supported models
      if (isOpenAIDirectAPI && (requestModel.includes('gpt-4') || requestModel.includes('gpt-3.5-turbo'))) {
        console.log('Using structured output for OpenAI API');
        completion = await openai.chat.completions.create({
          model: requestModel,
          messages: [
            { role: 'system', content: flaggingPrompt },
            { role: 'user', content: 'Analyze the conversation above for concerning content.' }
          ],
          max_tokens: 1000,
          temperature: 0.1,
          response_format: { 
            type: "json_schema",
            json_schema: {
              name: "flagging_analysis",
              schema: flaggingSchema,
              strict: true
            }
          }
        });
      } else {
        throw new Error('Using fallback JSON format');
      }
    } catch (schemaError) {
      console.log('Structured output not supported or failed, falling back to json_object format:', schemaError);
      // Fallback to basic JSON object format
      const enhancedPrompt = flaggingPrompt + `

CRITICAL INSTRUCTIONS FOR JSON OUTPUT:
You must respond with a valid JSON object that matches this exact structure:
{
  "shouldFlag": boolean,
  "reasoning": "string explaining your analysis",
  "severityBreakdown": {
    "ethical-concern": "none|low|medium|high",
    "harmful-content": "none|low|medium|high", 
    "misinformation": "none|low|medium|high",
    "bias": "none|low|medium|high",
    "other": "none|low|medium|high"
  },
  "flags": [
    {
      "type": "ethical-concern|harmful-content|misinformation|bias|other",
      "severity": "low|medium|high",
      "reason": "explanation of the concern",
      "flaggedText": "specific text that triggered the flag"
    }
  ]
}

Do not include any markdown formatting, code blocks, or additional text. Only return the JSON object.`;

      completion = await openai.chat.completions.create({
        model: requestModel,
        messages: [
          { role: 'system', content: enhancedPrompt },
          { role: 'user', content: 'Analyze the conversation above for concerning content. Return only valid JSON.' }
        ],
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
    }

    const flaggingResponse = completion.choices[0]?.message?.content;

    console.log('Raw flagging response:', {
      hasResponse: !!flaggingResponse,
      responseLength: flaggingResponse?.length || 0,
      responsePreview: flaggingResponse?.substring(0, 200) + '...'
    });

    if (!flaggingResponse) {
      console.error('No response from flagging system');
      return NextResponse.json(
        { error: 'No response from flagging system' },
        { status: 500 }
      );
    }

    // Parse the flagging response
    let flaggingResult;
    try {
      // First try direct JSON parsing
      flaggingResult = JSON.parse(flaggingResponse);
      console.log('Successfully parsed JSON response');
      
      // Validate essential fields
      if (typeof flaggingResult.shouldFlag !== 'boolean') {
        flaggingResult.shouldFlag = false;
      }
      
      // Ensure all required fields exist
      if (!flaggingResult.reasoning) {
        flaggingResult.reasoning = "Analysis completed successfully.";
      }
      
      if (!flaggingResult.severityBreakdown) {
        flaggingResult.severityBreakdown = {
          "ethical-concern": "none",
          "harmful-content": "none",
          "misinformation": "none",
          "bias": "none",
          "other": "none"
        };
      }
      
      if (!flaggingResult.flags || !Array.isArray(flaggingResult.flags)) {
        flaggingResult.flags = [];
      }
      
    } catch (parseError) {
      console.error('Failed to parse structured flagging response:', parseError);
      console.error('Raw response:', flaggingResponse);
      
      // Try to extract JSON from potentially malformed response
      try {
        let jsonString = flaggingResponse.trim();
        
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
        
        flaggingResult = JSON.parse(jsonString);
        console.log('Successfully parsed cleaned JSON response');
        
        // Validate and add missing fields
        if (typeof flaggingResult.shouldFlag !== 'boolean') {
          flaggingResult.shouldFlag = false;
        }
        if (!flaggingResult.reasoning) {
          flaggingResult.reasoning = "Analysis completed successfully.";
        }
        if (!flaggingResult.severityBreakdown) {
          flaggingResult.severityBreakdown = {
            "ethical-concern": "none",
            "harmful-content": "none",
            "misinformation": "none",
            "bias": "none",
            "other": "none"
          };
        }
        if (!flaggingResult.flags || !Array.isArray(flaggingResult.flags)) {
          flaggingResult.flags = [];
        }
        
      } catch (secondParseError) {
        console.error('Failed to parse cleaned JSON:', secondParseError);
        console.error('Attempting to create response from analysis text');
        
        // Try to extract meaningful information from the raw text
        const analysisText = flaggingResponse.toLowerCase();
        let hasFlag = false;
        let detectedFlags = [];
        
        // Look for key indicators in the response
        if (analysisText.includes('concerning') || analysisText.includes('flag') || 
            analysisText.includes('harmful') || analysisText.includes('inappropriate')) {
          hasFlag = true;
          detectedFlags.push({
            type: "other",
            severity: "medium",
            reason: "Content analysis detected potential concerns",
            flaggedText: flaggingResponse.substring(0, 100) + "..."
          });
        }
        
        // Final fallback with more detailed reasoning
        flaggingResult = { 
          shouldFlag: hasFlag, 
          flags: detectedFlags,
          reasoning: hasFlag ? 
            `Analysis detected potential concerns in the content. Raw analysis: ${flaggingResponse.substring(0, 200)}...` :
            "Analysis completed successfully. No concerning content detected.",
          severityBreakdown: {
            "ethical-concern": hasFlag ? "medium" : "none",
            "harmful-content": "none",
            "misinformation": "none",
            "bias": "none",
            "other": hasFlag ? "medium" : "none"
          }
        };
        
        console.log('Created fallback response:', {
          shouldFlag: flaggingResult.shouldFlag,
          hasFlags: flaggingResult.flags.length > 0,
          reasoning: flaggingResult.reasoning.substring(0, 100) + '...'
        });
      }
    }

    console.log('Final flagging result:', {
      shouldFlag: flaggingResult.shouldFlag,
      hasFlags: flaggingResult.flags?.length > 0,
      flagCount: flaggingResult.flags?.length || 0,
      reasoningLength: flaggingResult.reasoning?.length || 0,
      hasSeverityBreakdown: !!flaggingResult.severityBreakdown
    });

    return NextResponse.json(flaggingResult);

  } catch (error: unknown) {
    console.error('Flagging API Error:', error);
    
    // Handle specific OpenAI errors
    if (error instanceof Error && 'status' in error) {
      const openaiError = error as { status: number };
      
      if (openaiError.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key for flagging system.' },
          { status: 401 }
        );
      }
      
      if (openaiError.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded for flagging system.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to analyze content for flags.' },
      { status: 500 }
    );
  }
}
