import React, { useState, useCallback, useMemo, useRef } from 'react';
import { v4 } from 'uuid';
import { useToastContext } from '@librechat/client';
import { EModelEndpoint, EToolResources, FileSources } from 'librechat-data-provider';
import type { AgentToolResources, TFile } from 'librechat-data-provider';
import type { ExtendedFile } from '~/common';
import { useUploadFileMutation, useGetFiles } from '~/data-provider';
import type { FileSetter } from '~/common';
import { useAuthContext } from '~/hooks';
import { logger } from '~/utils';

interface UsePromptFileHandling {
  fileSetter?: FileSetter;
  initialFiles?: ExtendedFile[];
}

/**
 * Simplified file handling hook for prompts that doesn't depend on ChatContext
 */
export const usePromptFileHandling = (params?: UsePromptFileHandling) => {
  const { showToast } = useToastContext();
  const { user, token } = useAuthContext();
  const { data: allFiles = [] } = useGetFiles();

  /**
   * Create authenticated blob URL for images
   */
  const createAuthenticatedBlobUrl = useCallback(
    async (fileId: string): Promise<string | null> => {
      if (!user?.id || !token) return null;

      try {
        const response = await fetch(`/api/files/download/${user.id}/${fileId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error('Failed to fetch file:', response.status, response.statusText);
          return null;
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
      } catch (error) {
        console.error('Error creating authenticated blob URL:', error);
        return null;
      }
    },
    [user?.id, token],
  );

  // Create a fileMap for quick lookup
  const fileMap = useMemo(() => {
    const map: Record<string, TFile> = {};
    allFiles.forEach((file) => {
      if (file.file_id) {
        map[file.file_id] = file;
      }
    });
    return map;
  }, [allFiles]);
  const [files, setFiles] = useState<Map<string, ExtendedFile>>(() => {
    if (params?.initialFiles?.length) {
      const filesMap = new Map<string, ExtendedFile>();
      params.initialFiles.forEach((file) => {
        const key = file.file_id || file.temp_file_id || v4();
        filesMap.set(key, file);
      });
      return filesMap;
    }
    return new Map();
  });
  const [filesLoading, setFilesLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const uploadFile = useUploadFileMutation({
    onSuccess: (data) => {
      logger.log('File uploaded successfully', data);

      setFiles((prev) => {
        const newFiles = new Map(prev);

        for (const [key, file] of newFiles.entries()) {
          if (file.temp_file_id === data.temp_file_id) {
            const updatedFile = {
              ...file,
              file_id: data.file_id,
              filepath: data.filepath,
              progress: 1,
              attached: true,
              // Preserve the original blob URL preview for images
              preview:
                file.preview || (file.type?.startsWith('image/') ? data.filepath : undefined),
            };

            console.log('✅ Upload complete - File structure:', {
              file_id: updatedFile.file_id,
              filename: updatedFile.filename,
              type: updatedFile.type,
              filepath: updatedFile.filepath,
              preview: updatedFile.preview,
              size: updatedFile.size,
              width: updatedFile.width,
              height: updatedFile.height,
              progress: updatedFile.progress,
              attached: updatedFile.attached,
            });

            newFiles.set(key, updatedFile);
            break;
          }
        }

        return newFiles;
      });

      setFilesLoading(false);
      showToast({
        message: 'File uploaded successfully',
        status: 'success',
      });
    },
    onError: (error) => {
      logger.error('File upload error:', error);
      setFilesLoading(false);
      showToast({
        message: 'Failed to upload file',
        status: 'error',
      });
    },
  });

  // Convert files Map to array for easier consumption
  const promptFiles = useMemo(() => {
    return Array.from(files.values());
  }, [files]);

  // Load image and extract dimensions (like useFileHandling does)
  const loadImage = useCallback(
    (extendedFile: ExtendedFile, preview: string) => {
      const img = new Image();
      img.onload = async () => {
        console.log('📏 Image loaded, dimensions:', { width: img.width, height: img.height });

        const updatedFile = {
          ...extendedFile,
          width: img.width,
          height: img.height,
          progress: 0.6,
        };

        setFiles((prev) => new Map(prev.set(extendedFile.file_id, updatedFile)));

        // Create form data for upload
        const formData = new FormData();
        formData.append('endpoint', EModelEndpoint.agents);
        formData.append('file', extendedFile.file!, encodeURIComponent(extendedFile.filename));
        formData.append('file_id', extendedFile.file_id);
        formData.append('message_file', 'true'); // For prompts, treat as message attachment

        // Include dimensions for image recognition
        formData.append('width', img.width.toString());
        formData.append('height', img.height.toString());

        if (extendedFile.tool_resource) {
          formData.append('tool_resource', extendedFile.tool_resource.toString());
        }

        console.log('📤 Uploading with dimensions:', { width: img.width, height: img.height });
        // Upload the file with dimensions
        uploadFile.mutate(formData);
        URL.revokeObjectURL(preview);
      };
      img.src = preview;
    },
    [uploadFile],
  );

  // Handle file uploads
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, toolResource?: EToolResources | string) => {
      event.stopPropagation();
      if (!event.target.files) return;

      const fileList = Array.from(event.target.files);
      setFilesLoading(true);

      fileList.forEach(async (file) => {
        const file_id = v4();
        const temp_file_id = file_id; // Use same ID initially, backend will reassign

        console.log('📤 Starting upload:', {
          filename: file.name,
          type: file.type,
          size: file.size,
          file_id,
          temp_file_id,
        });

        // Add file to state immediately with progress indicator
        const extendedFile: ExtendedFile = {
          file_id,
          temp_file_id,
          type: file.type,
          filename: file.name,
          filepath: '',
          progress: 0,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
          size: file.size,
          width: undefined,
          height: undefined,
          attached: false,
          file,
          tool_resource: typeof toolResource === 'string' ? toolResource : undefined,
        };

        setFiles((prev) => new Map(prev.set(file_id, extendedFile)));

        // For images, load and extract dimensions before upload
        if (file.type.startsWith('image/') && extendedFile.preview) {
          console.log('🖼️ Image detected, extracting dimensions...');
          loadImage(extendedFile, extendedFile.preview);
        } else {
          // For non-images, upload immediately
          const formData = new FormData();
          formData.append('endpoint', EModelEndpoint.agents);
          formData.append('file', file, encodeURIComponent(file.name));
          formData.append('file_id', file_id);
          formData.append('message_file', 'true'); // For prompts, treat as message attachment

          if (toolResource) {
            formData.append('tool_resource', toolResource.toString());
          }

          uploadFile.mutate(formData);
        }
      });

      // Reset input
      event.target.value = '';
    },
    [uploadFile, loadImage],
  );

  // Handle file removal
  const handleFileRemove = useCallback(
    (fileId: string) => {
      setFiles((prev) => {
        const newFiles = new Map(prev);
        newFiles.delete(fileId);
        return newFiles;
      });

      // Call external fileSetter if provided
      if (params?.fileSetter) {
        const updatedFiles = Array.from(files.values()).filter(
          (f) => f.file_id !== fileId && f.temp_file_id !== fileId,
        );
        params.fileSetter(updatedFiles);
      }
    },
    [files, params?.fileSetter],
  );

  // Sync with external fileSetter when files change
  React.useEffect(() => {
    if (params?.fileSetter) {
      params.fileSetter(promptFiles);
    }
  }, [promptFiles, params?.fileSetter]);

  /**
   * Convert current files to tool_resources format for API submission
   */
  const getToolResources = useCallback((): AgentToolResources | undefined => {
    if (promptFiles.length === 0) {
      return undefined;
    }

    const toolResources: AgentToolResources = {};

    promptFiles.forEach((file) => {
      if (!file.file_id) return; // Skip files that haven't been uploaded yet

      // Determine tool resource type based on file type or explicit tool_resource
      let toolResource: EToolResources;

      if (file.tool_resource) {
        toolResource = file.tool_resource as EToolResources;
      } else if (file.type?.startsWith('image/')) {
        toolResource = EToolResources.image_edit;
      } else if (file.type === 'application/pdf' || file.type?.includes('text')) {
        toolResource = EToolResources.file_search;
      } else {
        toolResource = EToolResources.file_search; // Default fallback
      }

      // Initialize the tool resource if it doesn't exist
      if (!toolResources[toolResource]) {
        toolResources[toolResource] = { file_ids: [] };
      }

      // Add file_id to the appropriate tool resource
      if (!toolResources[toolResource]!.file_ids!.includes(file.file_id)) {
        toolResources[toolResource]!.file_ids!.push(file.file_id);
      }
    });

    return Object.keys(toolResources).length > 0 ? toolResources : undefined;
  }, [promptFiles]);

  /**
   * Load files from tool_resources format (for editing existing prompts)
   */
  const loadFromToolResources = useCallback(
    async (toolResources?: AgentToolResources) => {
      if (!toolResources) {
        setFiles(new Map());
        return;
      }

      const filesMap = new Map<string, ExtendedFile>();

      // Process all files and create blob URLs for images
      for (const [toolResource, resource] of Object.entries(toolResources)) {
        if (resource?.file_ids) {
          for (const fileId of resource.file_ids) {
            const dbFile = fileMap[fileId];
            const source =
              toolResource === EToolResources.file_search
                ? FileSources.vectordb
                : (dbFile?.source ?? FileSources.local);

            let file: ExtendedFile;

            if (dbFile) {
              // For images, create authenticated blob URL
              let previewUrl: string | undefined;
              if (dbFile.type?.startsWith('image/')) {
                previewUrl = await createAuthenticatedBlobUrl(dbFile.file_id);
                if (!previewUrl) {
                  // Fallback to original filepath if blob creation fails
                  previewUrl = dbFile.filepath;
                }
              }

              // Use real file metadata from database
              file = {
                file_id: dbFile.file_id,
                temp_file_id: dbFile.file_id,
                type: dbFile.type,
                filename: dbFile.filename,
                filepath: dbFile.filepath, // Keep original filepath
                progress: 1,
                preview: previewUrl, // Use authenticated blob URL for images
                size: dbFile.bytes || 0,
                width: dbFile.width,
                height: dbFile.height,
                attached: true,
                tool_resource: toolResource,
                metadata: dbFile.metadata,
                source,
              };

              console.log('📂 Loaded from DB - File structure:', {
                file_id: file.file_id,
                filename: file.filename,
                type: file.type,
                filepath: file.filepath,
                preview: file.preview,
                size: file.size,
                width: file.width,
                height: file.height,
                progress: file.progress,
                attached: file.attached,
                db_filepath: dbFile.filepath,
                preview_is_blob: file.preview?.startsWith('blob:'),
              });
            } else {
              // Fallback to placeholder if file not found in database
              file = {
                file_id: fileId,
                temp_file_id: fileId,
                type: 'application/octet-stream',
                filename: `File ${fileId}`,
                filepath: '',
                progress: 1,
                preview: '',
                size: 0,
                width: undefined,
                height: undefined,
                attached: true,
                tool_resource: toolResource,
                source,
              };
            }

            filesMap.set(fileId, file);
          }
        }
      }

      setFiles(filesMap);
    },
    [fileMap, createAuthenticatedBlobUrl],
  );

  /**
   * Check if all files have been uploaded successfully
   */
  const areFilesReady = useMemo(() => {
    return promptFiles.every((file) => file.file_id && file.progress === 1);
  }, [promptFiles]);

  /**
   * Get count of files by type
   */
  const fileStats = useMemo(() => {
    const stats = {
      total: promptFiles.length,
      images: 0,
      documents: 0,
      uploading: 0,
    };

    promptFiles.forEach((file) => {
      if (file.progress < 1) {
        stats.uploading++;
      } else if (file.type?.startsWith('image/')) {
        stats.images++;
      } else {
        stats.documents++;
      }
    });

    return stats;
  }, [promptFiles]);

  const abortUpload = useCallback(() => {
    if (abortControllerRef.current) {
      logger.log('files', 'Aborting upload');
      abortControllerRef.current.abort('User aborted upload');
      abortControllerRef.current = null;
    }
  }, []);

  return {
    // File handling functions
    handleFileChange,
    abortUpload,

    // File state
    files,
    setFiles,
    promptFiles,

    // Utility functions
    getToolResources,
    loadFromToolResources,
    areFilesReady,
    fileStats,
    handleFileRemove,
  };
};

export default usePromptFileHandling;
