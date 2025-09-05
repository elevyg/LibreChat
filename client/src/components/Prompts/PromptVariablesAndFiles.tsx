import React from 'react';
import type { AgentToolResources, ExtendedFile } from 'librechat-data-provider';
import PromptVariables from './PromptVariables';
import PromptFiles from './PromptFiles';

interface PromptVariablesAndFilesProps {
  promptText: string;
  files?: ExtendedFile[];
  onFilesChange?: (files: ExtendedFile[]) => void;
  onToolResourcesChange?: (toolResources?: AgentToolResources) => void;
  handleFileChange?: (event: React.ChangeEvent<HTMLInputElement>, toolResource?: string) => void;
  handleFileRemove?: (fileId: string) => void;
  disabled?: boolean;
  showVariablesInfo?: boolean;
}

const PromptVariablesAndFiles: React.FC<PromptVariablesAndFilesProps> = ({
  promptText,
  files = [],
  onFilesChange,
  onToolResourcesChange,
  handleFileChange,
  handleFileRemove,
  showVariablesInfo = true,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
      {/* Variables Section */}
      <div className="w-full">
        <PromptVariables promptText={promptText} showInfo={showVariablesInfo} />
      </div>

      {/* Files Section */}
      <div className="w-full">
        <PromptFiles
          files={files}
          onFilesChange={onFilesChange}
          onToolResourcesChange={onToolResourcesChange}
          handleFileChange={handleFileChange}
          handleFileRemove={handleFileRemove}
        />
      </div>
    </div>
  );
};

export default PromptVariablesAndFiles;
