// frontend/src/components/Documentation/DocumentationModal.tsx
import React, { useState } from 'react';
import { X, FileText, Loader2, BookOpen, Code, Users, GitBranch, RefreshCw } from 'lucide-react';
import { useDocumentation } from '@/hooks/useDocumentation';
import { triggerDocumentationGeneration } from '@/lib/github';

interface DocumentationModalProps {
  repoFullName: string;
  onClose: () => void;
}

const DocumentationModal: React.FC<DocumentationModalProps> = ({ repoFullName, onClose }) => {
  const { documents, loading } = useDocumentation(repoFullName);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  // Documents are already filtered by repoFullName from the hook
  const repoDocuments = documents;

  const docTypes = [
    {
      id: 'onboarding',
      label: 'Getting Started Guide',
      icon: <Users className="w-4 h-4" />,
      description: 'Comprehensive onboarding guide for new team members',
      color: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      id: 'architecture',
      label: 'Architecture Overview',
      icon: <GitBranch className="w-4 h-4" />,
      description: 'High-level system architecture and design patterns',
      color: 'bg-purple-50 text-purple-700 border-purple-200'
    },
    {
      id: 'api',
      label: 'API Documentation',
      icon: <Code className="w-4 h-4" />,
      description: 'Complete API reference with examples',
      color: 'bg-green-50 text-green-700 border-green-200'
    },
    {
      id: 'full-analysis',
      label: 'Complete Documentation',
      icon: <BookOpen className="w-4 h-4" />,
      description: 'Full comprehensive documentation suite',
      color: 'bg-orange-50 text-orange-700 border-orange-200'
    }
  ];

  const handleGenerateDoc = async (docType: string) => {
    setGenerating(prev => ({ ...prev, [docType]: true }));
    try {
      await triggerDocumentationGeneration(repoFullName, docType as any);
      // Optionally refresh documents here
    } catch (error) {
      console.error(`Failed to generate ${docType} documentation:`, error);
      // Show error toast
    } finally {
      setGenerating(prev => ({ ...prev, [docType]: false }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Documentation</h2>
            <p className="text-sm text-gray-600">{repoFullName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[60vh]">
          {/* Sidebar - Doc Types */}
          <div className="w-80 border-r border-gray-200 p-4 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Generate Documentation</h3>
            <div className="space-y-3">
              {docTypes.map((docType) => (
                <div
                  key={docType.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedDocType === docType.id
                      ? docType.color
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedDocType(docType.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {docType.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm mb-1">{docType.label}</h4>
                      <p className="text-xs text-gray-600">{docType.description}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateDoc(docType.id);
                        }}
                        disabled={generating[docType.id]}
                        className="mt-2 w-full py-2 px-3 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generating[docType.id] ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Generating...
                          </div>
                        ) : (
                          'Generate'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Existing Documents */}
            <h3 className="font-semibold text-gray-900 mb-4 mt-6">Existing Documents</h3>
            <div className="space-y-2">
              {repoDocuments.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No documents generated yet</p>
              ) : (
                repoDocuments.map((doc) => {
                  const docData = doc.analysis?.documentation;
                  const docTypeId = docData?.type || doc.analysis?.type || 'unknown';
                  const title = docData?.title || `${docTypeId} Documentation`;
                  const createdDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'Unknown date';
                  
                  return (
                    <div
                      key={doc.id}
                      className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => setSelectedDocType(docTypeId)}
                    >
                      <h4 className="font-medium text-sm">{title}</h4>
                      <p className="text-xs text-gray-600">Generated {createdDate}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Main Content - Documentation Viewer */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : selectedDocType ? (
              <DocumentViewer
                repoFullName={repoFullName}
                docType={selectedDocType}
                documents={repoDocuments}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FileText className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Select Documentation Type
                </h3>
                <p className="text-gray-600">
                  Choose a documentation type from the sidebar to view or generate content
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Document Viewer Component
const DocumentViewer: React.FC<{
  repoFullName: string;
  docType: string;
  documents: any[];
}> = ({ repoFullName, docType, documents }) => {
  // Find matching doc — check analysis.documentation.type first, then analysis.type
  const relevantDoc = documents.find(
    doc => (doc.analysis?.documentation?.type === docType) || (doc.analysis?.type === docType)
  );

  if (!relevantDoc) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No {docType} Documentation
        </h3>
        <p className="text-gray-600 mb-4">
          Generate this documentation type using the button in the sidebar
        </p>
      </div>
    );
  }

  // Support both nested (analysis.documentation) and flat structures
  const docData = relevantDoc.analysis?.documentation;
  const title = docData?.title || `${docType} Documentation`;
  const content = docData?.content || '';
  const metadata = docData?.metadata || {};

  if (!content) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Documentation Not Available
        </h3>
        <p className="text-gray-600 mb-4">
          The documentation content is empty. Try regenerating.
        </p>
      </div>
    );
  }

  return (
    <div className="prose prose-gray max-w-none text-gray-900">
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Generated {metadata.generatedAt ? new Date(metadata.generatedAt).toLocaleString() : 'recently'}</span>
          <span>Model: {metadata.model || 'template'}</span>
          {metadata.filesAnalyzed && (
            <span>Files: {metadata.filesAnalyzed}</span>
          )}
          {metadata.tokensUsed && (
            <span>Tokens: {metadata.tokensUsed.toLocaleString()}</span>
          )}
        </div>
      </div>
      
      <div 
        className="markdown-content text-gray-900 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }}
      />
    </div>
  );
};

// Simple markdown formatter with safety checks
const formatMarkdown = (content: string): string => {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  try {
    return content
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono"><code>$1</code></pre>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-gray-900 mt-5 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-gray-900 mt-6 mb-3 pb-1 border-b border-gray-200">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^- (.*$)/gim, '<div class="flex gap-2 ml-4 my-1"><span class="text-blue-500">•</span><span class="text-gray-800">$1</span></div>')
      .replace(/^(\d+)\. (.*$)/gim, '<div class="flex gap-2 ml-4 my-1"><span class="text-blue-500 font-medium">$1.</span><span class="text-gray-800">$2</span></div>')
      .replace(/\|(.*?)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.every(c => c.trim().match(/^[-:]+$/))) return '';
        return '<tr>' + cells.map(c => `<td class="border border-gray-200 px-3 py-2 text-gray-800">${c.trim()}</td>`).join('') + '</tr>';
      })
      .replace(/(<tr>.*<\/tr>\n?)+/g, '<table class="w-full border-collapse my-4 text-sm">$&</table>')
      .replace(/\n/g, '<br>');
  } catch (error) {
    console.error('Error formatting markdown:', error);
    return content; // Return original content if formatting fails
  }
};

export default DocumentationModal;