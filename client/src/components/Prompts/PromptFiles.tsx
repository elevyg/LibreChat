import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Separator } from '@librechat/client';
import type { AgentToolResources } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import FileRow from '~/components/Chat/Input/Files/FileRow';
import AttachFileButton from './Files/AttachFileButton';
import { useLocalize } from '~/hooks';

const PromptFiles = ({
  files,
  onFilesChange,
  onToolResourcesChange,
  handleFileChange,
  handleFileRemove,
}: {
  files: ExtendedFile[];
  onFilesChange?: (files: ExtendedFile[]) => void;
  onToolResourcesChange?: (toolResources?: AgentToolResources) => void;
  handleFileChange?: (event: React.ChangeEvent<HTMLInputElement>, toolResource?: string) => void;
  handleFileRemove?: (fileId: string) => void;
}) => {
  const localize = useLocalize();

  const [filesMap, setFilesMap] = useState(() => {
    const map = new Map<string, ExtendedFile>();
    files.forEach((file) => {
      const key = file.file_id || file.temp_file_id || '';
      if (key) {
        map.set(key, file);
      }
    });
    return map;
  });

  // Update filesMap when files prop changes
  React.useEffect(() => {
    const map = new Map<string, ExtendedFile>();
    files.forEach((file) => {
      const key = file.file_id || file.temp_file_id || '';
      if (key) {
        map.set(key, file);
      }
    });
    setFilesMap(map);
  }, [files]);

  const handleFilesChange = React.useCallback(
    (newFilesMapOrUpdater: React.SetStateAction<Map<string, ExtendedFile>>) => {
      setFilesMap((prevMap) => {
        const newMap =
          typeof newFilesMapOrUpdater === 'function'
            ? newFilesMapOrUpdater(prevMap)
            : newFilesMapOrUpdater;

        if (onFilesChange) {
          const newFilesArray = Array.from(newMap.values());
          onFilesChange(newFilesArray);
        }

        return newMap;
      });
    },
    [onFilesChange],
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-border-light bg-transparent p-4 shadow-md">
      <h3 className="flex items-center gap-2 py-2 text-lg font-semibold text-text-primary">
        <FileText className="icon-sm" aria-hidden="true" />
        {localize('com_ui_files')}
      </h3>
      <div className="flex flex-1 flex-col space-y-4">
        {!files.length && (
          <div className="text-sm text-text-secondary">
            <ReactMarkdown className="markdown prose dark:prose-invert">
              {localize('com_ui_files_info')}
            </ReactMarkdown>
          </div>
        )}

        {files.length > 0 && (
          <div className="mb-3 flex-1">
            <FileRow
              files={filesMap}
              setFiles={handleFilesChange}
              setFilesLoading={() => {}}
              Wrapper={({ children }) => <div className="flex flex-wrap gap-2">{children}</div>}
            />
          </div>
        )}

        <Separator className="my-3 text-text-primary" />
        <div className="flex flex-col justify-end text-text-secondary">
          <div className="flex justify-start">
            <AttachFileButton
              files={files}
              onFilesChange={onFilesChange}
              onToolResourcesChange={onToolResourcesChange}
              handleFileChange={handleFileChange}
              handleFileRemove={handleFileRemove}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptFiles;
