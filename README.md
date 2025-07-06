# AI Workflow Dashboard

A locally hosted Next.js TypeScript application with a dashboard featuring two main modes for AI interaction analysis and real-time chat.

## Features

### 🔍 Dialog Analysis Mode
- Upload conversation log files containing interactions between users and AI workflows
- Analyze conversations with LLM, agents, and other AI systems
- View conversation statistics and insights
- Support for text, log, and JSON file formats

### 💬 Interactive Mode
- **Default Chat**: Zero-shot LLM chat interface
- **Custom Workflow**: Upload and use custom AI workflows
- Real-time conversation interface
- File upload for workflow configurations

## Technical Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom UI components
- **Icons**: Lucide React
- **Development**: Turbopack for fast builds
- **Code Quality**: ESLint

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser** and navigate to [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
├── app/
│   ├── globals.css          # Global styles with CSS variables
│   ├── layout.tsx           # Root layout component
│   ├── page.tsx             # Main page with Dashboard
│   └── types.ts             # TypeScript type definitions
├── components/
│   ├── Dashboard.tsx        # Main dashboard with mode selection
│   ├── DialogAnalysisPanel.tsx  # Dialog analysis interface
│   ├── InteractivePanel.tsx     # Interactive chat interface
│   └── ui/
│       ├── button.tsx       # Button component
│       └── card.tsx         # Card component
└── lib/
    └── utils.ts             # Utility functions
```

## Usage

### Dialog Analysis Mode
1. Click "Start Dialog Analysis" on the dashboard
2. Upload a conversation log file (txt, log, or json)
3. View the analysis results and conversation statistics

### Interactive Mode
1. Choose between "Default Chat" or "Custom Workflow"
2. For custom workflows, upload your workflow configuration file
3. Start chatting with the AI system

## Development

This project uses modern React patterns with:
- Functional components and hooks
- TypeScript for type safety
- Tailwind CSS for styling
- Clean, modular component structure

The application is designed to be easily extensible for additional analysis features and AI integrations.
