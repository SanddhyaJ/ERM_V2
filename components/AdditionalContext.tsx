import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Shield } from 'lucide-react';

interface AdditionalContextProps {
  context: string;
  onContextChange: (context: string) => void;
}

export default function AdditionalContext({ context, onContextChange }: AdditionalContextProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <FileText className="w-5 h-5 mr-2" />
          Additional Context
        </CardTitle>
        <CardDescription>
          Provide context for better analysis and summaries
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Context Information
            </label>
            <textarea
              value={context}
              onChange={(e) => onContextChange(e.target.value)}
              placeholder="Enter context-specific information (used for both summary generation and flagging analysis)..."
              className="w-full p-2 border rounded-md text-sm resize-none"
              rows={3}
            />
            {context && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                <div className="flex items-center">
                  <Shield className="w-3 h-3 mr-1" />
                  This context is used by both the flagging system and summary generation
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
