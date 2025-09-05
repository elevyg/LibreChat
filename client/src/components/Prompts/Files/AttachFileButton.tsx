import React, { useRef, useState, useMemo } from 'react';
import * as Ariakit from '@ariakit/react';
import { FileSearch, ImageUpIcon, TerminalSquareIcon, FileType2Icon } from 'lucide-react';
import { EToolResources } from 'librechat-data-provider';
import { FileUpload, DropdownPopup, AttachmentIcon } from '@librechat/client';
import type { ExtendedFile, AgentToolResources } from 'librechat-data-provider';
import { useLocalize, usePromptFileHandling } from '~/hooks';
import { MenuItemProps } from '~/common';
import { cn } from '~/utils';

interface AttachFileButtonProps {
  files?: ExtendedFile[];
  onFilesChange?: (files: ExtendedFile[]) => void;
  onToolResourcesChange?: (toolResources?: AgentToolResources) => void;
  handleFileChange?: (event: React.ChangeEvent<HTMLInputElement>, toolResource?: string) => void;
  handleFileRemove?: (fileId: string) => void;
  disabled?: boolean | null;
}

const AttachFileButton = ({
  files = [],
  onFilesChange,
  onToolResourcesChange,
  handleFileChange: parentHandleFileChange,
  handleFileRemove: parentHandleFileRemove,
  disabled,
}: AttachFileButtonProps) => {
  const localize = useLocalize();
  const isUploadDisabled = disabled ?? false;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const [toolResource, setToolResource] = useState<EToolResources | undefined>();

  // Use parent's file handling functions if provided, otherwise create our own
  const shouldUseOwnHook = !parentHandleFileChange || !parentHandleFileRemove;
  const ownHook = shouldUseOwnHook
    ? usePromptFileHandling({
        initialFiles: files,
        fileSetter: onFilesChange,
      })
    : null;

  const handleFileChange = parentHandleFileChange || ownHook?.handleFileChange;
  const handleFileRemove = parentHandleFileRemove || ownHook?.handleFileRemove;

  const handleUploadClick = (isImage?: boolean) => {
    if (!inputRef.current) {
      return;
    }
    inputRef.current.value = '';
    inputRef.current.accept = isImage === true ? 'image/*' : '';
    inputRef.current.click();
    inputRef.current.accept = '';
  };

  // Update tool resources when files change
  // Tool resources are managed by the parent component when using parent's file handling
  React.useEffect(() => {
    if (onToolResourcesChange && shouldUseOwnHook && ownHook?.getToolResources) {
      const toolResources = ownHook.getToolResources();
      onToolResourcesChange(toolResources);
    }
  }, [onToolResourcesChange, shouldUseOwnHook, ownHook?.promptFiles, ownHook?.getToolResources]);

  const dropdownItems = useMemo(() => {
    return [
      {
        label: localize('com_ui_upload_image_input'),
        onClick: () => {
          setToolResource(undefined);
          handleUploadClick(true);
        },
        icon: <ImageUpIcon className="icon-md" />,
      },
      {
        label: localize('com_ui_upload_ocr_text'),
        onClick: () => {
          setToolResource(EToolResources.ocr);
          handleUploadClick();
        },
        icon: <FileType2Icon className="icon-md" />,
      },
      {
        label: localize('com_ui_upload_file_search'),
        onClick: () => {
          setToolResource(EToolResources.file_search);
          handleUploadClick();
        },
        icon: <FileSearch className="icon-md" />,
      },
      {
        label: localize('com_ui_upload_code_files'),
        onClick: () => {
          setToolResource(EToolResources.execute_code);
          handleUploadClick();
        },
        icon: <TerminalSquareIcon className="icon-md" />,
      },
    ];
  }, [localize, setToolResource, handleUploadClick]);

  const menuTrigger = (
    <Ariakit.MenuButton
      disabled={isUploadDisabled}
      id="attach-file-button-menu"
      aria-label="Attach File Options"
      className={cn(
        'flex items-center gap-2 rounded-md border border-border-medium bg-surface-primary px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50',
      )}
    >
      <AttachmentIcon className="h-4 w-4" />
      {localize('com_ui_attach_files')}
    </Ariakit.MenuButton>
  );

  return (
    <FileUpload
      ref={inputRef}
      handleFileChange={(e) => {
        handleFileChange(e, toolResource);
      }}
    >
      <DropdownPopup
        menuId="attach-file-button"
        className="overflow-visible"
        isOpen={isPopoverActive}
        setIsOpen={setIsPopoverActive}
        modal={true}
        unmountOnHide={true}
        trigger={menuTrigger}
        items={dropdownItems}
        iconClassName="mr-0"
      />
    </FileUpload>
  );
};

export default React.memo(AttachFileButton);
