'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { validateFile, formatFileSize, getMaxFileSize } from '@/lib/utils/fileTypes';

interface FileUploaderProps {
    onUploadComplete?: () => void;
    currentFolderId?: string | null;
}

interface PresignResponse {
    uploadUrl: string;
    token: string;
    path: string;
    fileKey: string;
    metadata: {
        uniqueFilename: string;
        sanitizedFilename: string;
        shortCode: string;
        fileSize: number;
        mimeType: string;
        userId: string;
        folderId: string | null;
    };
}

interface FileWithPath extends File {
    relativePath?: string;
    targetFolderId?: string | null;
}

export default function FileUploader({ onUploadComplete, currentFolderId }: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const [error, setError] = useState('');
    const abortControllerRef = useRef<AbortController | null>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Set webkitdirectory attribute on mount (non-standard attribute)
    useEffect(() => {
        if (folderInputRef.current) {
            folderInputRef.current.setAttribute('webkitdirectory', '');
        }
    }, []);

    /**
     * Creates a folder via API and returns its ID
     */
    const createFolder = async (name: string, parentId: string | null): Promise<string> => {
        const response = await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parentId }),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to create folder');
        }

        const data = await response.json();
        return data.folder.id;
    };

    /**
     * Recursively reads all files from a directory entry
     */
    const readDirectoryEntries = async (directoryEntry: FileSystemDirectoryEntry, basePath: string = ''): Promise<FileWithPath[]> => {
        const files: FileWithPath[] = [];
        const reader = directoryEntry.createReader();
        
        const readEntries = (): Promise<FileSystemEntry[]> => {
            return new Promise((resolve, reject) => {
                reader.readEntries(resolve, reject);
            });
        };

        // Read entries in batches (readEntries may not return all at once)
        let entries: FileSystemEntry[] = [];
        let batch: FileSystemEntry[];
        do {
            batch = await readEntries();
            entries = entries.concat(batch);
        } while (batch.length > 0);

        for (const entry of entries) {
            const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
            
            if (entry.isFile) {
                const fileEntry = entry as FileSystemFileEntry;
                const file = await new Promise<FileWithPath>((resolve, reject) => {
                    fileEntry.file((f) => {
                        const fileWithPath = f as FileWithPath;
                        fileWithPath.relativePath = entryPath;
                        resolve(fileWithPath);
                    }, reject);
                });
                files.push(file);
            } else if (entry.isDirectory) {
                const dirEntry = entry as FileSystemDirectoryEntry;
                const subFiles = await readDirectoryEntries(dirEntry, entryPath);
                files.push(...subFiles);
            }
        }
        
        return files;
    };

    /**
     * Process dropped items and extract files from folders
     * Returns: { files, rootFolderName } - rootFolderName is set if a single folder was dropped
     */
    const processDroppedItems = async (dataTransfer: DataTransfer): Promise<{ files: FileWithPath[]; rootFolderName: string | null }> => {
        const files: FileWithPath[] = [];
        const items = dataTransfer.items;
        let rootFolderName: string | null = null;

        // Check if webkitGetAsEntry is available (for folder support)
        if (items && items.length > 0 && items[0].webkitGetAsEntry) {
            const entries: FileSystemEntry[] = [];
            
            for (let i = 0; i < items.length; i++) {
                const entry = items[i].webkitGetAsEntry();
                if (entry) {
                    entries.push(entry);
                }
            }

            // Check if exactly one directory was dropped (folder upload)
            if (entries.length === 1 && entries[0].isDirectory) {
                rootFolderName = entries[0].name;
            }

            for (const entry of entries) {
                if (entry.isFile) {
                    const fileEntry = entry as FileSystemFileEntry;
                    const file = await new Promise<FileWithPath>((resolve, reject) => {
                        fileEntry.file((f) => {
                            const fileWithPath = f as FileWithPath;
                            fileWithPath.relativePath = f.name;
                            resolve(fileWithPath);
                        }, reject);
                    });
                    files.push(file);
                } else if (entry.isDirectory) {
                    const dirEntry = entry as FileSystemDirectoryEntry;
                    // For folder uploads, we only want the files inside (not the folder path prefix)
                    const subFiles = await readDirectoryEntries(dirEntry, '');
                    files.push(...subFiles);
                }
            }
        } else {
            // Fallback: just use files directly
            const fileList = Array.from(dataTransfer.files) as FileWithPath[];
            fileList.forEach(f => f.relativePath = f.name);
            files.push(...fileList);
        }

        return { files, rootFolderName };
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        try {
            const { files, rootFolderName } = await processDroppedItems(e.dataTransfer);
            if (files.length > 0) {
                let targetFolderId = currentFolderId || null;
                
                // If a folder was dropped, create it first
                if (rootFolderName) {
                    try {
                        targetFolderId = await createFolder(rootFolderName, currentFolderId || null);
                    } catch (err: any) {
                        setError(`Failed to create folder "${rootFolderName}": ${err.message}`);
                        return;
                    }
                }
                
                // Set target folder for all files
                files.forEach(f => f.targetFolderId = targetFolderId);
                handleFiles(files);
            }
        } catch (err) {
            setError('Failed to process dropped items');
        }
    }, [currentFolderId]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as FileWithPath[];
            
            // For folder selection, webkitRelativePath contains "folderName/path/to/file"
            // Detect if this is a folder upload by checking if paths have a common root
            let rootFolderName: string | null = null;
            const firstPath = (files[0] as any)?.webkitRelativePath;
            if (firstPath && firstPath.includes('/')) {
                const potentialRoot = firstPath.split('/')[0];
                const allSameRoot = files.every((f: any) => 
                    f.webkitRelativePath?.startsWith(potentialRoot + '/')
                );
                if (allSameRoot) {
                    rootFolderName = potentialRoot;
                }
            }
            
            // Set relative paths (strip root folder name since we're creating the folder)
            files.forEach(f => {
                const webkitPath = (f as any).webkitRelativePath;
                if (webkitPath && rootFolderName) {
                    // Remove the root folder prefix from display path
                    f.relativePath = webkitPath.substring(rootFolderName.length + 1);
                } else {
                    f.relativePath = webkitPath || f.name;
                }
            });
            
            // Create folder and upload
            (async () => {
                let targetFolderId = currentFolderId || null;
                
                if (rootFolderName) {
                    try {
                        targetFolderId = await createFolder(rootFolderName, currentFolderId || null);
                    } catch (err: any) {
                        setError(`Failed to create folder "${rootFolderName}": ${err.message}`);
                        return;
                    }
                }
                
                files.forEach(f => f.targetFolderId = targetFolderId);
                handleFiles(files);
            })();
            
            // Reset input value to allow selecting the same folder again
            e.target.value = '';
        }
    }, [currentFolderId]);

    /**
     * Upload a single file using presigned URL (direct to Supabase)
     */
    const uploadFileWithPresignedUrl = async (file: FileWithPath): Promise<void> => {
        const displayName = file.relativePath || file.name;
        
        // Step 1: Get presigned upload URL from our API
        const presignResponse = await fetch('/api/files/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: file.name,
                fileSize: file.size,
                mimeType: file.type || 'application/octet-stream',
                folderId: file.targetFolderId || null,
            }),
        });

        if (!presignResponse.ok) {
            const errorData = await presignResponse.json();
            throw new Error(errorData.error || 'Failed to get upload URL');
        }

        const presignData: PresignResponse = await presignResponse.json();

        // Step 2: Upload file directly to Supabase using XMLHttpRequest for progress tracking
        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 95); // Reserve 5% for confirm
                    setUploadProgress(prev => ({ ...prev, [displayName]: percentComplete }));
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed - network error'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload cancelled'));
            });

            // Open connection and set headers
            xhr.open('PUT', presignData.uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
            
            // Send the file
            xhr.send(file);

            // Store abort controller reference for potential cancellation
            abortControllerRef.current = {
                abort: () => xhr.abort(),
            } as AbortController;
        });

        // Step 3: Confirm upload and save metadata
        setUploadProgress(prev => ({ ...prev, [displayName]: 97 }));
        
        const confirmResponse = await fetch('/api/files/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                metadata: presignData.metadata,
            }),
        });

        if (!confirmResponse.ok) {
            const errorData = await confirmResponse.json();
            throw new Error(errorData.error || 'Failed to confirm upload');
        }

        setUploadProgress(prev => ({ ...prev, [displayName]: 100 }));
    };

    const handleFiles = async (files: FileWithPath[]) => {
        setError('');
        setIsUploading(true);

        try {
            for (const file of files) {
                // Client-side validation
                const validation = validateFile(file);
                if (!validation.valid) {
                    throw new Error(`${file.relativePath || file.name}: ${validation.error}`);
                }

                const displayName = file.relativePath || file.name;
                setUploadProgress(prev => ({ ...prev, [displayName]: 0 }));

                // Use presigned URL upload for all files
                await uploadFileWithPresignedUrl(file);
            }

            setTimeout(() => {
                setUploadProgress({});
                onUploadComplete?.();
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'Failed to upload files');
        } finally {
            setIsUploading(false);
            abortControllerRef.current = null;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    border: isDragging ? '2px dashed #3b82f6' : '2px dashed #3a3a3a',
                    borderRadius: '6px',
                    padding: '2rem',
                    textAlign: 'center',
                    backgroundColor: isDragging ? '#1e3a5f' : 'transparent',
                    transition: 'all 0.2s',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '6px',
                        backgroundColor: '#3a3a3a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <svg style={{ width: '32px', height: '32px', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>

                    <div>
                        <p style={{
                            fontSize: '1rem',
                            fontWeight: 500,
                            color: '#e0e0e0',
                            marginBottom: '0.25rem',
                        }}>
                            Drop files or folders here
                        </p>
                        <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                            Max {formatFileSize(getMaxFileSize())} per file • Supports folders
                        </p>
                    </div>

                    <input
                        type="file"
                        id="file-upload"
                        multiple
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                        disabled={isUploading}
                    />

                    <input
                        ref={folderInputRef}
                        type="file"
                        id="folder-upload"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                        disabled={isUploading}
                    />

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            type="button"
                            onClick={() => document.getElementById('file-upload')?.click()}
                            disabled={isUploading}
                            style={{
                                padding: '0.625rem 1.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'white',
                                backgroundColor: '#3b82f6',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isUploading ? 'not-allowed' : 'pointer',
                                opacity: isUploading ? 0.6 : 1,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                if (!isUploading) e.currentTarget.style.backgroundColor = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                                if (!isUploading) e.currentTarget.style.backgroundColor = '#3b82f6';
                            }}
                        >
                            {isUploading ? 'Uploading...' : 'Select Files'}
                        </button>
                        <button
                            type="button"
                            onClick={() => document.getElementById('folder-upload')?.click()}
                            disabled={isUploading}
                            style={{
                                padding: '0.625rem 1.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: '#e0e0e0',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: isUploading ? 'not-allowed' : 'pointer',
                                opacity: isUploading ? 0.6 : 1,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                if (!isUploading) e.currentTarget.style.borderColor = '#6b7280';
                            }}
                            onMouseLeave={(e) => {
                                if (!isUploading) e.currentTarget.style.borderColor = '#3a3a3a';
                            }}
                        >
                            Select Folder
                        </button>
                    </div>
                </div>
            </div>

            {/* Upload Progress */}
            {Object.keys(uploadProgress).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(uploadProgress).map(([filename, progress]) => (
                        <div key={filename} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{
                                    color: '#e0e0e0',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>{filename}</span>
                                <span style={{ color: '#9ca3af' }}>{progress}%</span>
                            </div>
                            <div style={{
                                height: '0.5rem',
                                backgroundColor: '#1a1a1a',
                                borderRadius: '4px',
                                overflow: 'hidden',
                            }}>
                                <div
                                    style={{
                                        height: '100%',
                                        backgroundColor: '#3b82f6',
                                        width: `${progress}%`,
                                        transition: 'width 0.3s',
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '0.75rem',
                    borderRadius: '4px',
                    backgroundColor: '#7f1d1d',
                    border: '1px solid #ef4444',
                }}>
                    <p style={{ fontSize: '0.875rem', color: '#fecaca', margin: 0 }}>{error}</p>
                </div>
            )}
        </div>
    );
}
