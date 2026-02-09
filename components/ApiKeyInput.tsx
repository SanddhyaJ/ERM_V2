'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Key, Check, AlertCircle, Settings } from 'lucide-react';
import { ModelInfo } from '@/app/types';

interface ApiKeyInputProps {
  onApiKeySet: (apiKey: string, baseUrl?: string, selectedModel?: string) => void;
  isConnected: boolean;
  currentBaseUrl?: string;
  currentModel?: string;
}

export default function ApiKeyInput({ onApiKeySet, isConnected, currentBaseUrl, currentModel }: ApiKeyInputProps) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const fetchAvailableModels = async (key: string, url: string) => {
    setIsFetchingModels(true);
    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: key,
          baseUrl: url,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models || []);
        if (data.models && data.models.length > 0) {
          setSelectedModel(data.models[0].id);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch models');
      }
    } catch (error: unknown) {
      console.error('Error fetching models:', error);
      alert('Failed to fetch available models. Please check your API key and base URL.');
      setAvailableModels([]);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) return;
    
    setIsValidating(true);
    
    // Simple validation - check if it looks like an OpenAI API key
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      alert('Please enter a valid OpenAI API key (starts with sk-)');
      setIsValidating(false);
      return;
    }
    
    // If using custom base URL, fetch available models first
    if (baseUrl) {
      await fetchAvailableModels(apiKey, baseUrl);
      setIsValidating(false);
      return; // Don't connect yet, wait for model selection
    }
    
    // Test the API key with a simple request (for default OpenAI)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: apiKey,
          model: 'gpt-4o',
        }),
      });
      
      if (response.ok) {
  onApiKeySet(apiKey, undefined, 'gpt-4o');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Invalid API key. Please check and try again.');
      }
    } catch {
      alert('Failed to validate API key. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleModelSelection = async () => {
    if (!selectedModel) return;
    
    setIsValidating(true);
    
    // Test the API key with the selected model
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          apiKey: apiKey,
          baseUrl: baseUrl,
          model: selectedModel,
        }),
      });
      
      if (response.ok) {
        onApiKeySet(apiKey, baseUrl, selectedModel);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Invalid API key, base URL, or model. Please check and try again.');
      }
    } catch {
      alert('Failed to validate API key with selected model. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  if (isConnected) {
    const getHostname = (url: string): string => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    };

    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">
              {currentBaseUrl ? `Connected to ${getHostname(currentBaseUrl)}` : 'OpenAI Connected'}
            </span>
          </div>
          <p className="text-sm text-green-600 mt-1">
            {currentBaseUrl ? 'Custom endpoint validated successfully' : 'API key validated successfully'}
          </p>
          {currentModel && (
            <p className="text-sm text-green-600 mt-1">
              Model: <span className="font-medium">{currentModel}</span>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Key className="w-5 h-5 mr-2" />
          OpenAI API Key Required
        </CardTitle>
        <CardDescription>
          Enter your API key to enable AI chat functionality. Optionally configure a custom base URL for OpenAI-compatible APIs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-... or 'test' for demo"
                className="w-full p-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
              >
                {showApiKey ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 mt-1">
            Use "test" as the API key to try the demo with mock scores
          </div>

          {/* Advanced Settings Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-sm text-gray-600 hover:text-gray-800"
            >
              <Settings className="w-4 h-4 mr-2" />
              Advanced Settings
            </button>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="border-t pt-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Base URL (Optional)
                </label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1 (default)"
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Custom base URL for OpenAI-compatible APIs (Azure OpenAI, local models, etc.)
                </p>
              </div>
            </div>
          )}
          
          {/* Model Selection (for custom base URLs) */}
          {availableModels.length > 0 && (
            <div className="border-t pt-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.id} {model.owned_by && `(${model.owned_by})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Available models from your custom endpoint
                </p>
              </div>
              <Button 
                type="button"
                onClick={handleModelSelection}
                className="w-full mt-3"
                disabled={!selectedModel || isValidating}
              >
                {isValidating ? 'Connecting...' : 'Connect with Selected Model'}
              </Button>
            </div>
          )}

          {isFetchingModels && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Fetching available models...</p>
            </div>
          )}
          
          <div className="flex items-start space-x-2 text-sm text-orange-700 bg-orange-100 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Security Note:</p>
              <p>Your API key is only used for this session and is not stored anywhere. It&apos;s sent securely to make requests to OpenAI.</p>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={!apiKey.trim() || isValidating || availableModels.length > 0}
          >
            {isValidating ? 'Validating...' : baseUrl ? 'Fetch Available Models' : 'Connect to OpenAI'}
          </Button>
        </form>
        
        <div className="mt-4 text-xs text-gray-600">
          <p>Don&apos;t have an API key? <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Get one from OpenAI</a></p>
        </div>
      </CardContent>
    </Card>
  );
}
