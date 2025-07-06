'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, MessageCircle, FileText, Bot, Workflow } from 'lucide-react';
import { DashboardMode } from '@/app/types';
import DialogAnalysisPanel from './DialogAnalysisPanel';
import InteractivePanel from './InteractivePanel';

export default function Dashboard() {
  const [selectedMode, setSelectedMode] = useState<DashboardMode | null>(null);

  const handleModeSelect = (mode: DashboardMode) => {
    setSelectedMode(mode);
  };

  const handleBack = () => {
    setSelectedMode(null);
  };

  if (selectedMode?.type === 'dialog-analysis') {
    return <DialogAnalysisPanel onBack={handleBack} />;
  }

  if (selectedMode?.type === 'interactive') {
    return <InteractivePanel mode={selectedMode} onBack={handleBack} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Ethics Reasoning Module
          </h1>
          <p className="text-xl text-gray-600">
            Choose your analysis mode to get started
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Dialog Analysis Mode */}
          <Card className="hover:shadow-lg bg-white transition-shadow cursor-pointer border-2 hover:border-blue-300">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Dialog Analysis Mode</CardTitle>
              <CardDescription className="text-lg">
                Upload conversation logs to analyze interactions between users and AI workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <Upload className="w-4 h-4" />
                <span>Upload conversation log files</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <MessageCircle className="w-4 h-4" />
                <span>Analyze user-AI interactions</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <Bot className="w-4 h-4" />
                <span>Support for LLM, agents, and workflows</span>
              </div>
              <Button 
                onClick={() => handleModeSelect({ type: 'dialog-analysis' })}
                className="w-full mt-6"
                size="lg"
                variant="outline"
              >
                Start Dialog Analysis
              </Button>
            </CardContent>
          </Card>

          {/* Interactive Mode */}
          <Card className="hover:shadow-lg bg-white transition-shadow cursor-pointer border-2 hover:border-green-300">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-fit">
                <MessageCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">Interactive Mode</CardTitle>
              <CardDescription className="text-lg">
                Chat with real AI using OpenAI&apos;s GPT or upload custom workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <Bot className="w-4 h-4" />
                <span>Real OpenAI GPT integration</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <Workflow className="w-4 h-4" />
                <span>Custom workflow upload</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-600">
                <MessageCircle className="w-4 h-4" />
                <span>Real-time conversation</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-6">
                <Button 
                  onClick={() => handleModeSelect({ 
                    type: 'interactive', 
                    subMode: 'default-chat' 
                  })}
                  variant="outline"
                  size="sm"
                >
                  Default Chat
                </Button>
                <Button 
                  onClick={() => handleModeSelect({ 
                    type: 'interactive', 
                    subMode: 'custom-workflow' 
                  })}
                  variant="outline"
                  size="sm"
                >
                  Custom Workflow
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
